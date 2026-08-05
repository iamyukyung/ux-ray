import {
  assembleQuickReviewReport,
} from "@/lib/ai/assemble-quick-review-report";
import {
  getAiModelConfig,
  getReasoningEffortForStage,
  PIPELINE_VERSION,
} from "@/lib/ai/config";
import {
  collectCropMetadata,
  preprocessScreenshotImage,
} from "@/lib/ai/image-preprocess";
import {
  callStructuredOutput,
  createOpenAIClient,
  imagePart,
  textPart,
} from "@/lib/ai/openai-structured";
import {
  clearProcessedScreenBuffers,
  selectQuickReviewImages,
} from "@/lib/ai/pipeline/crop-selection";
import { isCompletePipelineReport } from "@/lib/ai/pipeline/report-validation";
import {
  isPipelineTimeoutError,
  type PipelineDeadlineContext,
} from "@/lib/ai/pipeline/pipeline-timeout";
import { postprocessPipelineDraft } from "@/lib/ai/postprocess-pipeline-draft";
import {
  buildQuickReviewerContextPrompt,
  getQuickReviewerSystemPrompt,
} from "@/lib/ai/prompts/quick-reviewer";
import { QuickReviewSchema } from "@/lib/ai/schemas/quick-review";
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
  logPipelineComplete,
  logScreenshotReviewError,
  setPipelineStage,
  type PipelineStageTracker,
} from "@/lib/ai/pipeline/pipeline-stage";
import { formatDomSnapshotForPrompt } from "@/lib/capture/dom-snapshot";

function pipelineFailure(
  tracker: PipelineStageTracker,
  error: ScreenshotReviewApiError
): { ok: false; error: ScreenshotReviewApiError } {
  return { ok: false, error };
}

function logQuickReviewDev(input: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[quick-review:complete]", input);
}

export async function runQuickReviewPipeline(
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
  let processedScreens: import("@/lib/ai/image-preprocess").ProcessedScreenImage[] = [];
  let aiCallCount = 0;

  try {
    deadline.assertNotAborted(tracker.stage);
    setPipelineStage(tracker, "image-preprocessing");

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

    setPipelineStage(tracker, "reviewer-request");
    deadline.assertNotAborted(tracker.stage);

    const imageParts = selectQuickReviewImages(processedScreens, {
      domSnapshot: input.urlContext?.domSnapshot,
    });

    const screenOrder = sortedScreens.map((screen) => ({
      screenId: screen.id,
      screenName: screen.screenName,
      order: screen.order,
    }));

    const contextPrompt = buildQuickReviewerContextPrompt({
      reviewMode: input.metadata.reviewMode,
      reviewLens: input.metadata.reviewLens,
      screenLayoutMode: input.metadata.screenLayoutMode,
      projectName: input.metadata.projectName,
      userGoal: input.metadata.userGoal,
      targetUser: input.metadata.targetUser,
      focusArea: input.metadata.focusArea,
      screenOrder,
      urlContext: input.urlContext
        ? {
            requestedUrl: input.urlContext.requestedUrl,
            finalUrl: input.urlContext.finalUrl,
            pageTitle: input.urlContext.pageTitle,
            deviceType: input.urlContext.deviceType,
            domSnapshotJson: formatDomSnapshotForPrompt(input.urlContext.domSnapshot),
          }
        : undefined,
    });

    const content = [
      textPart(contextPrompt),
      ...imageParts.flatMap((part) =>
        imagePart(part.buffer, part.mimeType, part.detail, part.label)
      ),
    ];

    const aiStartedAt = Date.now();
    const draft = await callStructuredOutput({
      client,
      model: config.reviewerModel,
      instructions: getQuickReviewerSystemPrompt(input.metadata.reviewLens),
      input: [{ role: "user", content }],
      schema: QuickReviewSchema,
      schemaName: "quick_review",
      reasoningEffort: getReasoningEffortForStage(config, "reviewer"),
      signal: deadline.signal,
      requestTimeoutMs: deadline.getRemainingMs(),
    });
    aiCallCount = 1;
    const aiDurationMs = Date.now() - aiStartedAt;

    setPipelineStage(tracker, "reviewer-parse");
    deadline.assertNotAborted(tracker.stage);

    if (!draft) {
      return pipelineFailure(
        tracker,
        apiError(
          "AI_REFUSAL",
          "업로드한 화면을 분석할 수 없어요. 다른 화면으로 다시 시도해주세요."
        )
      );
    }

    const cropMetadata = collectCropMetadata(processedScreens);
    const validScreenIds = new Set(sortedScreens.map((screen) => screen.id));

    const postprocessed = postprocessPipelineDraft(draft, {
      reviewMode: input.metadata.screenLayoutMode,
      validScreenIds,
      cropMetadata,
    });

    const finalDraft = postprocessed.draft;
    const maxIssues = input.metadata.screenLayoutMode === "single-screen" ? 4 : 5;
    finalDraft.issues = finalDraft.issues.slice(0, maxIssues);

    if (finalDraft.issues.length === 0) {
      return pipelineFailure(
        tracker,
        apiError(
          "INVALID_AI_RESPONSE",
          "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요."
        )
      );
    }

    setPipelineStage(tracker, "report-assembly");
    deadline.assertNotAborted(tracker.stage);

    const report = assembleQuickReviewReport({
      metadata: input.metadata,
      draft: finalDraft,
      cropMetadata,
    });

    if (!isCompletePipelineReport(report)) {
      return pipelineFailure(
        tracker,
        apiError(
          "INVALID_AI_RESPONSE",
          "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요."
        )
      );
    }

    const totalDurationMs = Date.now() - pipelineStartedAt;
    const sourceType = input.metadata.sourceType === "url" ? "url" : "image";

    logQuickReviewDev({
      requestId,
      sourceType,
      reviewMode: input.metadata.reviewMode,
      reviewLens: input.metadata.reviewLens,
      inputScreenCount: sortedScreens.length,
      aiImageCount: imageParts.length,
      cropCount: cropMetadata.length,
      aiDurationMs,
      totalDurationMs,
      aiCallCount,
      finalIssueCount: report.issues.length,
      success: true,
    });

    logPipelineComplete({
      requestId,
      totalDurationMs,
      observerDurationMs: 0,
      reviewerDurationMs: aiDurationMs,
      criticDurationMs: 0,
      rewriteDurationMs: 0,
      wasRewritten: false,
      success: true,
      reviewLens: input.metadata.reviewLens,
      principleTaggedIssueCount: report.issues.filter((issue) => issue.principle != null).length,
    });

    return {
      ok: true,
      result: {
        report,
        debug: {
          requestId,
          source: "ai",
          aiIssueCount: draft.issues.length,
          renderedIssueCount: report.issues.length,
          analysisType: "ai",
          pipelineVersion: PIPELINE_VERSION,
        },
      },
    };
  } catch (error) {
    logScreenshotReviewError(requestId, tracker.stage, error);

    logQuickReviewDev({
      requestId,
      reviewMode: input.metadata.reviewMode,
      reviewLens: input.metadata.reviewLens,
      aiCallCount,
      success: false,
      errorCode:
        error instanceof Error && isPipelineTimeoutError(error)
          ? "PIPELINE_TIMEOUT"
          : "INTERNAL_ERROR",
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
        apiError("PIPELINE_TIMEOUT", "AI 리뷰 생성 시간이 초과했어요.")
      );
    }

    return pipelineFailure(tracker, classifyScreenshotReviewError(error));
  } finally {
    clearProcessedScreenBuffers(processedScreens);
  }
}
