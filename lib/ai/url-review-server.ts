import { capturePublicUrl } from "@/lib/capture/capture-public-url";
import { summarizeDomSnapshot } from "@/lib/capture/dom-snapshot";
import type { CapturedUrlPage, UrlReviewRequest } from "@/lib/capture/url-types";
import {
  URL_REVIEW_ERROR_MESSAGES,
  UrlReviewError,
  statusForUrlReviewError,
} from "@/lib/capture/url-review-errors";
import { hostnameForLog, normalizePublicUrl } from "@/lib/capture/validate-public-url";
import { getScreenshotReviewTimeoutMs } from "@/lib/ai/config";
import { createPipelineDeadlineContext } from "@/lib/ai/pipeline/pipeline-timeout";
import { isCompletePipelineReport } from "@/lib/ai/pipeline/report-validation";
import {
  analyzeScreenshotsWithOpenAI,
  type ScreenshotReviewAnalysisResult,
  type ScreenshotReviewApiError,
  type ValidatedScreenshotInput,
} from "@/lib/ai/screenshot-review-server";
import { sha256Prefix } from "@/lib/ai/image-buffer-utils";
import type { PipelineStageTracker } from "@/lib/ai/pipeline/pipeline-stage";
import { buildUrlScreenAssetsTransfer } from "@/lib/ai/url-screen-assets";
import { z } from "zod";

export type UrlReviewApiError = {
  error: {
    code: import("@/lib/capture/url-types").UrlReviewErrorCode;
    message: string;
    stage?: import("@/lib/ai/pipeline/pipeline-stage").PipelineStage;
  };
};

const UrlReviewRequestSchema = z.object({
  url: z.string().trim().min(1),
  deviceType: z.enum(["desktop", "mobile"]),
  reviewLens: z.enum(["general", "norman"]).optional(),
  projectName: z.string().optional(),
  userGoal: z.string().optional(),
  targetUser: z.string().optional(),
  focusArea: z.string().optional(),
  externalProcessingConsent: z.boolean(),
});

export function urlApiError(
  code: UrlReviewApiError["error"]["code"],
  message?: string
): UrlReviewApiError {
  return {
    error: {
      code,
      message: message ?? URL_REVIEW_ERROR_MESSAGES[code],
    },
  };
}

export function parseUrlReviewRequest(body: unknown):
  | { ok: true; value: UrlReviewRequest }
  | { ok: false; error: UrlReviewApiError } {
  const parsed = UrlReviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: urlApiError("INVALID_URL") };
  }

  if (!parsed.data.externalProcessingConsent) {
    return {
      ok: false,
      error: urlApiError(
        "INVALID_URL",
        "외부 AI 전송에 동의해야 리뷰를 시작할 수 있어요."
      ),
    };
  }

  try {
    normalizePublicUrl(parsed.data.url);
  } catch (error) {
    if (error instanceof UrlReviewError) {
      return { ok: false, error: urlApiError(error.code, error.message) };
    }
    return { ok: false, error: urlApiError("INVALID_URL") };
  }

  return {
    ok: true,
    value: {
      ...parsed.data,
      reviewLens: parsed.data.reviewLens ?? "general",
    },
  };
}

export function buildValidatedInputFromCapture(
  request: UrlReviewRequest,
  captured: CapturedUrlPage
): ValidatedScreenshotInput {
  const screenId = "url-screen-1";
  const deviceType = request.deviceType;

  return {
    metadata: {
      reviewMode: "single-screen",
      reviewLens: request.reviewLens,
      sourceType: "url",
      urlSource: {
        requestedUrl: captured.requestedUrl,
        finalUrl: captured.finalUrl,
        pageTitle: captured.pageTitle,
        deviceType,
      },
      projectName:
        request.projectName?.trim() ||
        captured.pageTitle?.trim() ||
        hostnameForLog(captured.finalUrl),
      userGoal: request.userGoal?.trim() || undefined,
      targetUser: request.targetUser?.trim() || undefined,
      focusArea: request.focusArea?.trim() || undefined,
      screens: [
        {
          id: screenId,
          screenName: captured.pageTitle?.trim() || "캡처 화면",
          deviceType,
          width: captured.width,
          height: captured.height,
          order: 0,
        },
      ],
    },
    images: [
      {
        buffer: captured.fullPageImage,
        mimeType: captured.mimeType,
        size: captured.fullPageImage.byteLength,
        sha256Prefix: sha256Prefix(captured.fullPageImage),
        serverWidth: captured.width,
        serverHeight: captured.height,
      },
    ],
    urlContext: {
      requestedUrl: captured.requestedUrl,
      finalUrl: captured.finalUrl,
      pageTitle: captured.pageTitle,
      deviceType,
      domSnapshot: captured.domSnapshot,
    },
  };
}

export async function analyzeUrlWithOpenAI(
  request: UrlReviewRequest,
  requestId: string,
  options?: {
    signal?: AbortSignal;
    stageTracker?: PipelineStageTracker;
    onCaptured?: (captured: CapturedUrlPage, captureDurationMs: number) => void;
  }
): Promise<
  { ok: true; result: ScreenshotReviewAnalysisResult } | { ok: false; error: UrlReviewApiError }
> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: urlApiError("AI_NOT_CONFIGURED") };
  }

  const startedAt = Date.now();
  let captured: CapturedUrlPage | null = null;

  try {
    const captureStartedAt = Date.now();
    captured = await capturePublicUrl({
      url: request.url,
      deviceType: request.deviceType,
      signal: options?.signal,
    });
    const captureDurationMs = Date.now() - captureStartedAt;
    options?.onCaptured?.(captured, captureDurationMs);

    const input = buildValidatedInputFromCapture(request, captured);
    const deadline = createPipelineDeadlineContext(getScreenshotReviewTimeoutMs());

    try {
      const result = await analyzeScreenshotsWithOpenAI(
        input,
        requestId,
        deadline,
        options?.stageTracker
      );

      if (!result.ok) {
        const code =
          result.error.error.code === "PIPELINE_TIMEOUT"
            ? "PIPELINE_TIMEOUT"
            : result.error.error.code === "AI_NOT_CONFIGURED"
              ? "AI_NOT_CONFIGURED"
              : result.error.error.code === "INVALID_AI_RESPONSE"
                ? "INVALID_AI_RESPONSE"
                : "INTERNAL_ERROR";

        return {
          ok: false,
          error: {
            error: {
              code,
              message: URL_REVIEW_ERROR_MESSAGES[code] ?? result.error.error.message,
              stage: result.error.error.stage,
            },
          },
        };
      }

      if (!isCompletePipelineReport(result.result.report)) {
        return { ok: false, error: urlApiError("INVALID_AI_RESPONSE") };
      }

      const screenId = "url-screen-1";
      const assetBundle = await buildUrlScreenAssetsTransfer({
        reviewId: requestId,
        screenId,
        captured,
        cropMetadata: result.result.report.cropMetadata,
      });

      const reportWithAssets: ScreenshotReviewAnalysisResult["report"] = {
        ...result.result.report,
        screenAssets: assetBundle.refs,
      };

      if (process.env.NODE_ENV === "development") {
        const domSummary = summarizeDomSnapshot(captured.domSnapshot);
        const reportJson = JSON.stringify(reportWithAssets);
        console.info("[url-review:complete]", {
          requestId,
          sourceType: "url",
          requestedHostname: hostnameForLog(captured.requestedUrl),
          finalHostname: hostnameForLog(captured.finalUrl),
          deviceType: request.deviceType,
          reviewLens: request.reviewLens,
          captureDurationMs,
          capturedWidth: captured.width,
          capturedHeight: captured.height,
          domHeadingCount: domSummary.headingCount,
          domInteractiveElementCount: domSummary.interactiveCount,
          cropCount: result.result.debug.diagnostics?.cropCount,
          observerMs: result.result.debug.diagnostics?.observerMs,
          reviewerMs: result.result.debug.diagnostics?.reviewerMs,
          criticMs: result.result.debug.diagnostics?.criticMs,
          principleTaggedIssueCount: result.result.report.issues.filter(
            (issue) => issue.principle != null
          ).length,
          totalDurationMs: Date.now() - startedAt,
          success: true,
        });
        console.info("[url-review:assets]", {
          requestId,
          previewWidth: assetBundle.refs[0]?.previewWidth,
          previewHeight: assetBundle.refs[0]?.previewHeight,
          previewByteSize: assetBundle.previewByteSize,
          screenAssetCount: assetBundle.transfer.length,
          reportHasBase64: reportJson.includes('"base64"'),
        });
      }

      return {
        ok: true,
        result: {
          ...result.result,
          report: reportWithAssets,
          screenAssetsTransfer: assetBundle.transfer,
        },
      };
    } finally {
      deadline.cleanup();
    }
  } catch (error) {
    if (error instanceof UrlReviewError) {
      return { ok: false, error: urlApiError(error.code, error.message) };
    }

    if (process.env.NODE_ENV === "development") {
      console.info("[url-review:complete]", {
        requestId,
        sourceType: "url",
        requestedHostname: captured ? hostnameForLog(captured.requestedUrl) : hostnameForLog(request.url),
        finalHostname: captured ? hostnameForLog(captured.finalUrl) : undefined,
        deviceType: request.deviceType,
        reviewLens: request.reviewLens,
        totalDurationMs: Date.now() - startedAt,
        success: false,
        code: "INTERNAL_ERROR",
      });
    }

    return { ok: false, error: urlApiError("INTERNAL_ERROR") };
  } finally {
    if (captured) {
      captured.fullPageImage = Buffer.alloc(0);
    }
  }
}

export { statusForUrlReviewError };
