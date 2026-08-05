import OpenAI from "openai";
import {
  assemblePipelineReport,
  buildPipelineDebugInfo,
  type PipelineDiagnostics,
} from "@/lib/ai/assemble-pipeline-report";
import {
  getAiModelConfig,
  getReasoningEffortForStage,
} from "@/lib/ai/config";
import {
  collectCropMetadata,
  preprocessScreenshotImage,
  type ProcessedCrop,
  type ProcessedScreenImage,
} from "@/lib/ai/image-preprocess";
import {
  callStructuredOutput,
  createOpenAIClient,
  imagePart,
  textPart,
} from "@/lib/ai/openai-structured";
import {
  buildValidCropIdSet,
  clearProcessedScreenBuffers,
  reviewerCropIdSet,
  selectCriticCrops,
  selectReviewerCrops,
} from "@/lib/ai/pipeline/crop-selection";
import { isCompletePipelineReport } from "@/lib/ai/pipeline/report-validation";
import {
  CRITIC_MIN_REMAINING_MS,
  isPipelineTimeoutError,
  type PipelineDeadlineContext,
} from "@/lib/ai/pipeline/pipeline-timeout";
import {
  postprocessPipelineDraft,
} from "@/lib/ai/postprocess-pipeline-draft";
import { runOpenAiSchemaSmokeCheck } from "@/lib/ai/schemas/schema-smoke-check";
import {
  buildObserverScreenPrompt,
  SCREENSHOT_OBSERVER_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/screenshot-observer";
import {
  buildCriticInputPrompt,
  SCREENSHOT_CRITIC_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/screenshot-review-critic";
import {
  buildReviewerContextPrompt,
  buildReviewerRewritePrompt,
  getReviewerSystemPrompt,
} from "@/lib/ai/prompts/screenshot-reviewer";
import {
  isCritiqueApproved,
  ScreenshotReviewCritiqueSchema,
  type ScreenshotReviewCritique,
} from "@/lib/ai/schemas/screenshot-review-critique";
import {
  ScreenshotReviewDraftSchema,
  type ScreenshotReviewDraft,
} from "@/lib/ai/schemas/screenshot-review-draft";
import {
  ScreenshotObservationSchema,
  type ScreenshotObservation,
} from "@/lib/ai/schemas/screenshot-observation";
import type {
  ScreenshotReviewAnalysisResult,
  ScreenshotReviewApiError,
  ValidatedScreenshotInput,
} from "@/lib/ai/screenshot-review-server";
import {
  apiError,
  classifyScreenshotReviewError,
} from "@/lib/ai/screenshot-review-server";
import {
  createStageTracker,
  logOpenAICallPrep,
  logPipelineComplete,
  logScreenshotReviewError,
  logStageComplete,
  pipelineFailure,
  setPipelineStage,
  type PipelineStageTracker,
} from "@/lib/ai/pipeline/pipeline-stage";
import { SCREEN_DEVICE_LABELS } from "@/lib/types";
import { formatDomSnapshotForPrompt } from "@/lib/capture/dom-snapshot";

async function runObserverForScreen(
  client: ReturnType<typeof createOpenAIClient>,
  config: ReturnType<typeof getAiModelConfig>,
  processed: ProcessedScreenImage,
  screenMeta: ValidatedScreenshotInput["metadata"]["screens"][number],
  urlContext: ValidatedScreenshotInput["urlContext"],
  requestId: string,
  deadline: PipelineDeadlineContext,
  tracker: PipelineStageTracker
): Promise<ScreenshotObservation | null> {
  deadline.assertNotAborted(tracker.stage);

  const cropIds = processed.crops.map((crop) => crop.metadata.cropId);
  const content = [
    textPart(
      buildObserverScreenPrompt({
        screenId: screenMeta.id,
        screenName: screenMeta.screenName,
        deviceType: SCREEN_DEVICE_LABELS[screenMeta.deviceType],
        width: processed.width,
        height: processed.height,
        cropIds,
        urlContext: urlContext
          ? {
              requestedUrl: urlContext.requestedUrl,
              finalUrl: urlContext.finalUrl,
              pageTitle: urlContext.pageTitle,
              domSnapshotJson: formatDomSnapshotForPrompt(urlContext.domSnapshot),
            }
          : undefined,
      })
    ),
    ...imagePart(
      processed.overviewBuffer,
      "image/jpeg",
      config.overviewImageDetail,
      "전체 페이지 Overview"
    ),
  ];

  if (processed.crops.length === 0) {
    content.push(
      ...imagePart(
        processed.analysisBuffer,
        processed.analysisMimeType,
        config.cropImageDetail,
        "분석용 전체 화면 (분할 없음)"
      )
    );
  } else {
    for (const crop of processed.crops) {
      content.push(
        ...imagePart(
          crop.buffer,
          "image/jpeg",
          config.cropImageDetail,
          `Section crop ${crop.metadata.cropId} (${crop.metadata.locationLabel}, y=${crop.metadata.yStart}-${crop.metadata.yEnd})`
        )
      );
    }
  }

  logOpenAICallPrep({
    requestId,
    stage: "observer-request",
    model: config.observerModel,
    overviewImageDetail: config.overviewImageDetail,
    cropImageDetail: config.cropImageDetail,
    reasoningEffort: getReasoningEffortForStage(config, "observer"),
    overviewImageCount: 1,
    cropImageCount: processed.crops.length > 0 ? processed.crops.length : 1,
  });

  return callStructuredOutput({
    client,
    model: config.observerModel,
    instructions: SCREENSHOT_OBSERVER_SYSTEM_PROMPT,
    input: [{ role: "user", content }],
    schema: ScreenshotObservationSchema,
    schemaName: "screenshot_observation",
    reasoningEffort: getReasoningEffortForStage(config, "observer"),
    signal: deadline.signal,
    requestTimeoutMs: deadline.getRemainingMs(),
  });
}

function buildReviewerInput(
  context: ValidatedScreenshotInput["metadata"],
  observations: ScreenshotObservation[],
  processedScreens: ProcessedScreenImage[],
  config: ReturnType<typeof getAiModelConfig>,
  selectedCrops: ProcessedCrop[],
  urlContext: ValidatedScreenshotInput["urlContext"],
  rewrite?: {
    previousDraft: ScreenshotReviewDraft;
    critique: ScreenshotReviewCritique;
  }
): OpenAI.Responses.ResponseCreateParams["input"] {
  const selectedCropIds = reviewerCropIdSet(selectedCrops);
  const screenOrder = [...context.screens]
    .sort((a, b) => a.order - b.order)
    .map((screen) => ({
      screenId: screen.id,
      screenName: screen.screenName,
      order: screen.order,
    }));

  const content = [
    textPart(
      buildReviewerContextPrompt({
        reviewLens: context.reviewLens,
        reviewMode: context.reviewMode,
        projectName: context.projectName,
        userGoal: context.userGoal,
        targetUser: context.targetUser,
        focusArea: context.focusArea,
        screenOrder,
        urlContext: urlContext
          ? {
              requestedUrl: urlContext.requestedUrl,
              finalUrl: urlContext.finalUrl,
              pageTitle: urlContext.pageTitle,
              deviceType: urlContext.deviceType,
              domSnapshotJson: formatDomSnapshotForPrompt(urlContext.domSnapshot),
            }
          : undefined,
      })
    ),
    textPart(`Observation JSON:\n${JSON.stringify(observations, null, 2)}`),
  ];

  if (rewrite) {
    content.push(
      textPart(
        buildReviewerRewritePrompt({
          problems: rewrite.critique.problems,
          missingHighValueFindings: rewrite.critique.missingHighValueFindings,
          rewriteInstructions: rewrite.critique.rewriteInstructions,
        })
      ),
      textPart(`이전 Draft JSON:\n${JSON.stringify(rewrite.previousDraft, null, 2)}`)
    );
  }

  for (const processed of processedScreens) {
    content.push(
      ...imagePart(
        processed.overviewBuffer,
        "image/jpeg",
        config.overviewImageDetail,
        `Overview — ${processed.screenId}`
      )
    );

    for (const crop of processed.crops) {
      if (!selectedCropIds.has(crop.metadata.cropId)) continue;
      content.push(
        ...imagePart(
          crop.buffer,
          "image/jpeg",
          config.cropImageDetail,
          `Crop ${crop.metadata.cropId}`
        )
      );
    }
  }

  return [{ role: "user", content }];
}

function countStageImages(
  processedScreens: ProcessedScreenImage[],
  selectedCrops: ProcessedCrop[]
): { overviewCount: number; cropCount: number } {
  const selectedCropIds = reviewerCropIdSet(selectedCrops);
  let cropCount = 0;

  for (const screen of processedScreens) {
    cropCount += screen.crops.filter((crop) => selectedCropIds.has(crop.metadata.cropId)).length;
  }

  return { overviewCount: processedScreens.length, cropCount };
}

async function runReviewer(
  client: ReturnType<typeof createOpenAIClient>,
  config: ReturnType<typeof getAiModelConfig>,
  context: ValidatedScreenshotInput["metadata"],
  observations: ScreenshotObservation[],
  processedScreens: ProcessedScreenImage[],
  selectedCrops: ProcessedCrop[],
  urlContext: ValidatedScreenshotInput["urlContext"],
  requestId: string,
  deadline: PipelineDeadlineContext,
  tracker: PipelineStageTracker,
  rewrite?: {
    previousDraft: ScreenshotReviewDraft;
    critique: ScreenshotReviewCritique;
  }
): Promise<ScreenshotReviewDraft | null> {
  deadline.assertNotAborted(tracker.stage);

  const reasoningStage = rewrite ? "rewrite" : "reviewer";
  const { overviewCount, cropCount } = countStageImages(processedScreens, selectedCrops);

  logOpenAICallPrep({
    requestId,
    stage: tracker.stage,
    model: config.reviewerModel,
    overviewImageDetail: config.overviewImageDetail,
    cropImageDetail: config.cropImageDetail,
    reasoningEffort: getReasoningEffortForStage(config, reasoningStage),
    overviewImageCount: overviewCount,
    cropImageCount: cropCount,
  });

  return callStructuredOutput({
    client,
    model: config.reviewerModel,
    instructions: getReviewerSystemPrompt(context.reviewLens),
    input: buildReviewerInput(
      context,
      observations,
      processedScreens,
      config,
      selectedCrops,
      urlContext,
      rewrite
    ),
    schema: ScreenshotReviewDraftSchema,
    schemaName: "screenshot_review_draft",
    reasoningEffort: getReasoningEffortForStage(config, reasoningStage),
    signal: deadline.signal,
    requestTimeoutMs: deadline.getRemainingMs(),
  });
}

function buildCriticInput(
  context: ValidatedScreenshotInput["metadata"],
  observations: ScreenshotObservation[],
  draft: ScreenshotReviewDraft,
  processedScreens: ProcessedScreenImage[],
  selectedCrops: ProcessedCrop[],
  config: ReturnType<typeof getAiModelConfig>
): OpenAI.Responses.ResponseCreateParams["input"] {
  const selectedCropIds = reviewerCropIdSet(selectedCrops);

  const content = [
    textPart(
      buildCriticInputPrompt({
        reviewLens: context.reviewLens,
        userGoal: context.userGoal,
        focusArea: context.focusArea,
      })
    ),
    textPart(`Observation JSON:\n${JSON.stringify(observations, null, 2)}`),
    textPart(`Reviewer Draft JSON:\n${JSON.stringify(draft, null, 2)}`),
  ];

  for (const processed of processedScreens) {
    content.push(
      ...imagePart(
        processed.overviewBuffer,
        "image/jpeg",
        config.overviewImageDetail,
        `Overview — ${processed.screenId}`
      )
    );

    for (const crop of processed.crops) {
      if (!selectedCropIds.has(crop.metadata.cropId)) continue;
      content.push(
        ...imagePart(
          crop.buffer,
          "image/jpeg",
          config.cropImageDetail,
          `Referenced crop ${crop.metadata.cropId}`
        )
      );
    }
  }

  return [{ role: "user", content }];
}

async function runCritic(
  client: ReturnType<typeof createOpenAIClient>,
  config: ReturnType<typeof getAiModelConfig>,
  context: ValidatedScreenshotInput["metadata"],
  observations: ScreenshotObservation[],
  draft: ScreenshotReviewDraft,
  processedScreens: ProcessedScreenImage[],
  selectedCrops: ProcessedCrop[],
  requestId: string,
  deadline: PipelineDeadlineContext,
  tracker: PipelineStageTracker
): Promise<ScreenshotReviewCritique | null> {
  deadline.assertNotAborted(tracker.stage);

  const { overviewCount, cropCount } = countStageImages(processedScreens, selectedCrops);

  logOpenAICallPrep({
    requestId,
    stage: "critic-request",
    model: config.criticModel,
    overviewImageDetail: config.overviewImageDetail,
    cropImageDetail: config.cropImageDetail,
    reasoningEffort: getReasoningEffortForStage(config, "critic"),
    overviewImageCount: overviewCount,
    cropImageCount: cropCount,
  });

  return callStructuredOutput({
    client,
    model: config.criticModel,
    instructions: SCREENSHOT_CRITIC_SYSTEM_PROMPT,
    input: buildCriticInput(
      context,
      observations,
      draft,
      processedScreens,
      selectedCrops,
      config
    ),
    schema: ScreenshotReviewCritiqueSchema,
    schemaName: "screenshot_review_critique",
    reasoningEffort: getReasoningEffortForStage(config, "critic"),
    signal: deadline.signal,
    requestTimeoutMs: deadline.getRemainingMs(),
  });
}

export async function runScreenshotPipelineV2(
  input: ValidatedScreenshotInput,
  requestId: string,
  deadline: PipelineDeadlineContext,
  stageTracker?: PipelineStageTracker
): Promise<
  { ok: true; result: ScreenshotReviewAnalysisResult } | { ok: false; error: ScreenshotReviewApiError }
> {
  const tracker = stageTracker ?? createStageTracker("image-preprocessing");
  const config = getAiModelConfig();
  const pipelineStartedAt = Date.now();
  let processedScreens: ProcessedScreenImage[] = [];
  let responded = false;

  let observerDurationMs = 0;
  let reviewerDurationMs = 0;
  let criticDurationMs = 0;
  let rewriteDurationMs = 0;
  let wasRewritten = false;

  try {
    runOpenAiSchemaSmokeCheck();
    deadline.assertNotAborted(tracker.stage);

    const client = createOpenAIClient(deadline.getRemainingMs());
    const sortedScreens = [...input.metadata.screens].sort((a, b) => a.order - b.order);

    for (let index = 0; index < sortedScreens.length; index += 1) {
      deadline.assertNotAborted(tracker.stage);
      const screen = sortedScreens[index]!;
      const image = input.images[index]!;
      processedScreens.push(
        await preprocessScreenshotImage(
          {
            screenId: screen.id,
            buffer: image.buffer,
            mimeType: image.mimeType,
            width: image.serverWidth ?? screen.width,
            height: image.serverHeight ?? screen.height,
            sha256Prefix: image.sha256Prefix,
          },
          tracker
        )
      );
    }

    const cropMetadata = collectCropMetadata(processedScreens);
    const validScreenIds = new Set(sortedScreens.map((screen) => screen.id));
    const validCropIds = buildValidCropIdSet(processedScreens);

    const observerStartedAt = Date.now();
    const observations: ScreenshotObservation[] = [];

    for (let index = 0; index < sortedScreens.length; index += 1) {
      setPipelineStage(tracker, "observer-request");
      deadline.assertNotAborted(tracker.stage);

      const observation = await runObserverForScreen(
        client,
        config,
        processedScreens[index]!,
        sortedScreens[index]!,
        input.urlContext,
        requestId,
        deadline,
        tracker
      );

      setPipelineStage(tracker, "observer-parse");
      deadline.assertNotAborted(tracker.stage);

      if (!observation) {
        responded = true;
        return pipelineFailure(
          tracker,
          apiError(
            "AI_REFUSAL",
            "업로드한 화면을 분석할 수 없어요. 다른 화면으로 다시 시도해주세요."
          )
        );
      }

      observations.push({ ...observation, screenId: sortedScreens[index]!.id });
    }

    observerDurationMs = Date.now() - observerStartedAt;
    logStageComplete({
      requestId,
      stage: "observer",
      durationMs: observerDurationMs,
      success: true,
    });

    const reviewerStartedAt = Date.now();
    setPipelineStage(tracker, "reviewer-request");
    deadline.assertNotAborted(tracker.stage);

    const initialReviewerCrops = selectReviewerCrops(processedScreens, { validCropIds });
    let draft = await runReviewer(
      client,
      config,
      input.metadata,
      observations,
      processedScreens,
      initialReviewerCrops,
      input.urlContext,
      requestId,
      deadline,
      tracker
    );

    setPipelineStage(tracker, "reviewer-parse");
    deadline.assertNotAborted(tracker.stage);

    if (!draft) {
      responded = true;
      return pipelineFailure(
        tracker,
        apiError(
          "INVALID_AI_RESPONSE",
          "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요."
        )
      );
    }

    reviewerDurationMs = Date.now() - reviewerStartedAt;
    logStageComplete({
      requestId,
      stage: "reviewer",
      durationMs: reviewerDurationMs,
      success: true,
    });

    deadline.ensureTimeForStage("critic-request", CRITIC_MIN_REMAINING_MS);
    setPipelineStage(tracker, "critic-request");
    deadline.assertNotAborted(tracker.stage);

    const criticStartedAt = Date.now();
    const criticCrops = selectCriticCrops(processedScreens, draft, validCropIds);
    let critique = await runCritic(
      client,
      config,
      input.metadata,
      observations,
      draft,
      processedScreens,
      criticCrops,
      requestId,
      deadline,
      tracker
    );

    setPipelineStage(tracker, "critic-parse");
    deadline.assertNotAborted(tracker.stage);

    if (!critique) {
      responded = true;
      return pipelineFailure(
        tracker,
        apiError(
          "INVALID_AI_RESPONSE",
          "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요."
        )
      );
    }

    criticDurationMs = Date.now() - criticStartedAt;
    logStageComplete({
      requestId,
      stage: "critic",
      durationMs: criticDurationMs,
      success: true,
    });

    if (!isCritiqueApproved(critique)) {
      deadline.ensureTimeForStage("reviewer-request", CRITIC_MIN_REMAINING_MS);
      deadline.assertNotAborted(tracker.stage);

      const rewriteStartedAt = Date.now();
      setPipelineStage(tracker, "reviewer-request");

      const rewriteCrops = selectReviewerCrops(processedScreens, {
        validCropIds,
        draft,
      });

      const rewritten = await runReviewer(
        client,
        config,
        input.metadata,
        observations,
        processedScreens,
        rewriteCrops,
        input.urlContext,
        requestId,
        deadline,
        tracker,
        { previousDraft: draft, critique }
      );

      rewriteDurationMs = Date.now() - rewriteStartedAt;
      logStageComplete({
        requestId,
        stage: "rewrite",
        durationMs: rewriteDurationMs,
        success: Boolean(rewritten),
      });

      setPipelineStage(tracker, "reviewer-parse");
      deadline.assertNotAborted(tracker.stage);

      if (rewritten) {
        draft = rewritten;
        wasRewritten = true;

        deadline.ensureTimeForStage("critic-request", CRITIC_MIN_REMAINING_MS);
        setPipelineStage(tracker, "critic-request");
        deadline.assertNotAborted(tracker.stage);

        const secondCriticStartedAt = Date.now();
        const secondCriticCrops = selectCriticCrops(processedScreens, draft, validCropIds);
        critique = await runCritic(
          client,
          config,
          input.metadata,
          observations,
          draft,
          processedScreens,
          secondCriticCrops,
          requestId,
          deadline,
          tracker
        );
        criticDurationMs += Date.now() - secondCriticStartedAt;

        setPipelineStage(tracker, "critic-parse");
        deadline.assertNotAborted(tracker.stage);

        if (!critique) {
          responded = true;
          return pipelineFailure(
            tracker,
            apiError(
              "INVALID_AI_RESPONSE",
              "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요."
            )
          );
        }
      }
    }

    const postprocessed = postprocessPipelineDraft(draft, {
      reviewMode: input.metadata.reviewMode,
      validScreenIds,
      cropMetadata,
    });

    const aiIssueCount = draft.issues.length;
    const finalDraft = postprocessed.draft;

    if (finalDraft.issues.length === 0 && !postprocessed.excludedForInsufficientEvidence) {
      responded = true;
      return pipelineFailure(
        tracker,
        apiError(
          "INVALID_AI_RESPONSE",
          "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요."
        )
      );
    }

    const quality = {
      specificity: critique.scores.specificity,
      evidenceQuality: critique.scores.evidenceQuality,
      actionability: critique.scores.actionability,
      prioritization: critique.scores.prioritization,
      nonHallucination: critique.scores.nonHallucination,
      wasRewritten,
    };

    setPipelineStage(tracker, "report-assembly");
    deadline.assertNotAborted(tracker.stage);

    const report = assemblePipelineReport({
      metadata: input.metadata,
      draft: finalDraft,
      quality,
      cropMetadata,
    });

    if (!isCompletePipelineReport(report)) {
      responded = true;
      return pipelineFailure(
        tracker,
        apiError(
          "INVALID_AI_RESPONSE",
          "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요."
        )
      );
    }

    const diagnostics: PipelineDiagnostics = {
      requestId,
      pipelineVersion: "2.0",
      screenCount: sortedScreens.length,
      cropCount: cropMetadata.length,
      imageFingerprints: input.images.map((image) => image.sha256Prefix),
      observerModel: config.observerModel,
      reviewerModel: config.reviewerModel,
      criticModel: config.criticModel,
      observerMs: observerDurationMs,
      reviewerMs: reviewerDurationMs,
      criticMs: criticDurationMs,
      wasRewritten,
      finalIssueCount: report.issues.length,
      qualityScores: quality,
      reviewLens: input.metadata.reviewLens,
      principleTaggedIssueCount: report.issues.filter((issue) => issue.principle != null).length,
    };

    logPipelineComplete({
      requestId,
      totalDurationMs: Date.now() - pipelineStartedAt,
      observerDurationMs,
      reviewerDurationMs,
      criticDurationMs,
      rewriteDurationMs,
      wasRewritten,
      success: true,
      reviewLens: input.metadata.reviewLens,
      principleTaggedIssueCount: diagnostics.principleTaggedIssueCount ?? 0,
    });

    responded = true;
    return {
      ok: true,
      result: {
        report,
        debug: buildPipelineDebugInfo({
          requestId,
          diagnostics,
          aiIssueCount,
          renderedIssueCount: report.issues.length,
        }),
      },
    };
  } catch (error) {
    if (!responded) {
      logScreenshotReviewError(requestId, tracker.stage, error);
    }

    logPipelineComplete({
      requestId,
      totalDurationMs: Date.now() - pipelineStartedAt,
      observerDurationMs,
      reviewerDurationMs,
      criticDurationMs,
      rewriteDurationMs,
      wasRewritten,
      success: false,
      reviewLens: input.metadata.reviewLens,
    });

    if (isPipelineTimeoutError(error)) {
      return pipelineFailure(
        tracker,
        apiError("PIPELINE_TIMEOUT", "AI 리뷰 생성 시간이 초과됐어요.")
      );
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      return pipelineFailure(
        tracker,
        apiError("PIPELINE_TIMEOUT", "AI 리뷰 생성 시간이 초과됐어요.")
      );
    }

    return pipelineFailure(tracker, classifyScreenshotReviewError(error));
  } finally {
    clearProcessedScreenBuffers(processedScreens);
  }
}
