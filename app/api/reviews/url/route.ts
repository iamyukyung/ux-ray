import { randomUUID } from "node:crypto";
import {
  createScreenshotReviewJob,
  completeScreenshotReviewJob,
  failScreenshotReviewJob,
  setScreenshotReviewJobStepIndex,
  updateScreenshotReviewJobStage,
} from "@/lib/ai/pipeline/screenshot-review-job-store";
import { createStageTracker } from "@/lib/ai/pipeline/pipeline-stage";
import { isCompletePipelineReport } from "@/lib/ai/pipeline/report-validation";
import {
  analyzeUrlWithOpenAI,
  parseUrlReviewRequest,
  statusForUrlReviewError,
  type UrlReviewApiError,
} from "@/lib/ai/url-review-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 615;

function errorResponse(error: UrlReviewApiError["error"], status: number): Response {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function runUrlReviewJob(reviewId: string, body: unknown, requestId: string): Promise<void> {
  const parsed = parseUrlReviewRequest(body);
  if (!parsed.ok) {
    failScreenshotReviewJob(reviewId, {
      code: parsed.error.error.code,
      message: parsed.error.error.message,
    });
    return;
  }

  setScreenshotReviewJobStepIndex(reviewId, 0);
  const tracker = createStageTracker("request-validation");
  tracker.onStageChange = (stage) => {
    updateScreenshotReviewJobStage(reviewId, stage);
    if (stage === "observer-request") setScreenshotReviewJobStepIndex(reviewId, 2);
    if (stage === "reviewer-request") setScreenshotReviewJobStepIndex(reviewId, 3);
    if (stage === "critic-request") setScreenshotReviewJobStepIndex(reviewId, 4);
    if (stage === "report-assembly") setScreenshotReviewJobStepIndex(reviewId, 5);
  };

  const result = await analyzeUrlWithOpenAI(parsed.value, requestId, {
    stageTracker: tracker,
    onCaptured: (_captured, _captureDurationMs) => {
      setScreenshotReviewJobStepIndex(reviewId, 1);
    },
  });

  if (!result.ok) {
    failScreenshotReviewJob(reviewId, {
      code: result.error.error.code,
      message: result.error.error.message,
      stage: result.error.error.stage,
    });
    return;
  }

  if (!isCompletePipelineReport(result.result.report)) {
    failScreenshotReviewJob(reviewId, {
      code: "INVALID_AI_RESPONSE",
      message: "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요.",
    });
    return;
  }

  completeScreenshotReviewJob(reviewId, result.result);
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      { code: "INVALID_URL", message: "요청 형식이 올바르지 않아요." },
      400
    );
  }

  const parsed = parseUrlReviewRequest(body);
  if (!parsed.ok) {
    return errorResponse(parsed.error.error, statusForUrlReviewError(parsed.error.error.code));
  }

  const requestId = randomUUID();
  const reviewId = requestId;
  createScreenshotReviewJob(reviewId);

  void runUrlReviewJob(reviewId, body, requestId);

  return Response.json(
    { reviewId },
    { status: 202, headers: { "Cache-Control": "no-store" } }
  );
}
