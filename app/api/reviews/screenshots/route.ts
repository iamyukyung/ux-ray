import { randomUUID } from "node:crypto";
import { getReviewTimeoutMs } from "@/lib/ai/config";
import {
  createStageTracker,
  logScreenshotReviewError,
  toClientErrorBody,
  type PipelineStage,
} from "@/lib/ai/pipeline/pipeline-stage";
import { createPipelineDeadlineContext } from "@/lib/ai/pipeline/pipeline-timeout";
import {
  completeScreenshotReviewJob,
  createScreenshotReviewJob,
  failScreenshotReviewJob,
  updateScreenshotReviewJobStage,
} from "@/lib/ai/pipeline/screenshot-review-job-store";
import {
  analyzeScreenshotsWithOpenAI,
  logScreenshotReviewImages,
  parseScreenshotReviewRequest,
  type ScreenshotReviewApiError,
  type ValidatedScreenshotInput,
} from "@/lib/ai/screenshot-review-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Max env timeout (600s) + 15s buffer — must be a route-local literal for Next.js. */
export const maxDuration = 615;

function errorResponse(error: ScreenshotReviewApiError["error"], status: number): Response {
  const clientError = toClientErrorBody(error, error.stage);

  return Response.json(
    { error: clientError },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function statusForErrorCode(code: ScreenshotReviewApiError["error"]["code"]): number {
  switch (code) {
    case "INVALID_INPUT":
    case "UNSUPPORTED_FILE":
      return 400;
    case "FILE_TOO_LARGE":
      return 413;
    case "TOO_MANY_IMAGES":
      return 400;
    case "AI_NOT_CONFIGURED":
      return 503;
    case "AI_RATE_LIMITED":
      return 429;
    case "AI_TIMEOUT":
    case "PIPELINE_TIMEOUT":
      return 504;
    case "AI_REFUSAL":
      return 422;
    case "INVALID_AI_RESPONSE":
      return 502;
    default:
      return 500;
  }
}

/** Observer/Reviewer/Critic 파이프라인을 백그라운드로 실행하고 진행 상태·결과를 job store에 저장합니다. */
async function runScreenshotReviewJob(
  reviewId: string,
  input: ValidatedScreenshotInput,
  requestId: string,
  startedAt: number
): Promise<void> {
  const deadline = createPipelineDeadlineContext(
    getReviewTimeoutMs(input.metadata.reviewMode)
  );
  const tracker = createStageTracker("request-validation");
  tracker.onStageChange = (stage: PipelineStage) => {
    updateScreenshotReviewJobStage(reviewId, stage);
  };

  try {
    const result = await analyzeScreenshotsWithOpenAI(input, requestId, deadline, tracker);

    console.info("[screenshot-review]", {
      requestId,
      durationMs: Date.now() - startedAt,
      success: result.ok,
      stage: tracker.stage,
      ...(result.ok
        ? {
            aiIssueCount: result.result.debug.aiIssueCount,
            renderedIssueCount: result.result.debug.renderedIssueCount,
            analysisType: result.result.debug.analysisType,
          }
        : { code: result.error.error.code }),
    });

    if (result.ok) {
      completeScreenshotReviewJob(reviewId, result.result);
    } else {
      failScreenshotReviewJob(reviewId, result.error.error);
    }
  } catch (error) {
    logScreenshotReviewError(requestId, tracker.stage, error);
    console.info("[screenshot-review]", {
      requestId,
      success: false,
      code: "INTERNAL_ERROR",
      stage: tracker.stage,
      durationMs: Date.now() - startedAt,
    });
    failScreenshotReviewJob(reviewId, {
      code: "INTERNAL_ERROR",
      message: "AI 리뷰를 만들지 못했어요. 잠시 후 다시 시도해주세요.",
    });
  } finally {
    deadline.cleanup();
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();

  const formData = await request.formData();
  const parsed = await parseScreenshotReviewRequest(formData);

  if (!parsed.ok) {
    console.info("[screenshot-review]", {
      requestId,
      success: false,
      code: parsed.error.error.code,
      durationMs: Date.now() - startedAt,
    });
    return errorResponse(parsed.error.error, statusForErrorCode(parsed.error.error.code));
  }

  logScreenshotReviewImages(requestId, parsed.value.images);

  const reviewId = requestId;
  createScreenshotReviewJob(reviewId, {
    reviewMode: parsed.value.metadata.reviewMode ?? "quick",
    inputType: "screenshots",
  });

  // 파이프라인은 백그라운드에서 계속 실행 — 응답을 막지 않습니다.
  void runScreenshotReviewJob(reviewId, parsed.value, requestId, startedAt);

  return Response.json(
    { reviewId },
    {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
