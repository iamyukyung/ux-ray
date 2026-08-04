import { randomUUID } from "node:crypto";
import { getScreenshotReviewTimeoutMs } from "@/lib/ai/config";
import {
  createStageTracker,
  logScreenshotReviewError,
  setPipelineStage,
  toClientErrorBody,
  type PipelineStage,
} from "@/lib/ai/pipeline/pipeline-stage";
import { createPipelineDeadlineContext } from "@/lib/ai/pipeline/pipeline-timeout";
import { isCompletePipelineReport } from "@/lib/ai/pipeline/report-validation";
import {
  analyzeScreenshotsWithOpenAI,
  logScreenshotReviewImages,
  parseScreenshotReviewRequest,
  type ScreenshotReviewApiError,
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

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const stageTracker = createStageTracker("request-validation");
  let stage: PipelineStage = stageTracker.stage;
  const deadline = createPipelineDeadlineContext(getScreenshotReviewTimeoutMs());
  let responded = false;

  try {
    setPipelineStage(stageTracker, "request-validation");
    stage = stageTracker.stage;

    const formData = await request.formData();
    const parsed = await parseScreenshotReviewRequest(formData);

    if (!parsed.ok) {
      responded = true;
      console.info("[screenshot-review]", {
        requestId,
        success: false,
        code: parsed.error.error.code,
        durationMs: Date.now() - startedAt,
      });
      return errorResponse(parsed.error.error, statusForErrorCode(parsed.error.error.code));
    }

    setPipelineStage(stageTracker, "image-metadata");
    stage = stageTracker.stage;

    logScreenshotReviewImages(requestId, parsed.value.images);

    const imageCount = parsed.value.images.length;
    const totalBytes = parsed.value.images.reduce((sum, image) => sum + image.size, 0);

    const result = await analyzeScreenshotsWithOpenAI(
      parsed.value,
      requestId,
      deadline,
      stageTracker
    );
    stage = stageTracker.stage;

    console.info("[screenshot-review]", {
      requestId,
      imageCount,
      totalBytes,
      durationMs: Date.now() - startedAt,
      success: result.ok,
      stage,
      ...(result.ok
        ? {
            aiIssueCount: result.result.debug.aiIssueCount,
            renderedIssueCount: result.result.debug.renderedIssueCount,
            analysisType: result.result.debug.analysisType,
          }
        : { code: result.error.error.code }),
    });

    if (!result.ok) {
      responded = true;
      return errorResponse(result.error.error, statusForErrorCode(result.error.error.code));
    }

    if (!isCompletePipelineReport(result.result.report)) {
      responded = true;
      return errorResponse(
        toClientErrorBody(
          {
            code: "INVALID_AI_RESPONSE",
            message: "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요.",
          },
          stage
        ),
        502
      );
    }

    responded = true;
    const body =
      process.env.NODE_ENV === "development"
        ? { report: result.result.report, _debug: result.result.debug }
        : { report: result.result.report };

    return Response.json(body, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (!responded) {
      stage = stageTracker.stage;
      logScreenshotReviewError(requestId, stage, error);

      console.info("[screenshot-review]", {
        requestId,
        success: false,
        code: "INTERNAL_ERROR",
        stage,
        durationMs: Date.now() - startedAt,
      });

      return errorResponse(
        toClientErrorBody(
          {
            code: "INTERNAL_ERROR",
            message: "AI 리뷰를 만들지 못했어요. 잠시 후 다시 시도해주세요.",
          },
          stage
        ),
        500
      );
    }

    throw error;
  } finally {
    deadline.cleanup();
  }
}
