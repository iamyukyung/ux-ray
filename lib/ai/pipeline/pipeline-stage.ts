import type { ReasoningEffort, ImageDetail } from "@/lib/ai/config";
import type { ScreenshotReviewApiError, ScreenshotReviewErrorCode } from "@/lib/ai/screenshot-review-server";

export type PipelineStage =
  | "request-validation"
  | "image-metadata"
  | "image-preprocessing"
  | "image-cropping"
  | "observer-request"
  | "observer-parse"
  | "reviewer-request"
  | "reviewer-parse"
  | "critic-request"
  | "critic-parse"
  | "report-assembly";

export interface PipelineStageTracker {
  stage: PipelineStage;
}

export function createStageTracker(
  initial: PipelineStage = "request-validation"
): PipelineStageTracker {
  return { stage: initial };
}

export function setPipelineStage(
  tracker: PipelineStageTracker,
  stage: PipelineStage
): void {
  tracker.stage = stage;
}

export interface ClientApiErrorBody {
  code: ScreenshotReviewErrorCode;
  message: string;
  stage?: PipelineStage;
}

export function logScreenshotReviewError(
  requestId: string,
  stage: PipelineStage,
  error: unknown
): void {
  if (process.env.NODE_ENV !== "development") return;

  console.error("[screenshot-review:error]", {
    requestId,
    stage,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: error instanceof Error ? error.message : "Unknown error",
    cause:
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : undefined,
    status:
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: unknown }).status
        : undefined,
  });
}

export function toClientErrorBody(
  error: ClientApiErrorBody,
  stage?: PipelineStage
): ClientApiErrorBody {
  if (process.env.NODE_ENV === "development") {
    return stage ? { ...error, stage } : error;
  }

  return {
    code: error.code,
    message: error.message,
  };
}

export function logOpenAICallPrep(input: {
  requestId: string;
  stage: PipelineStage;
  model: string;
  imageDetail: ImageDetail;
  reasoningEffort: ReasoningEffort;
  imageCount: number;
}): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[screenshot-review:openai-prep]", {
    requestId: input.requestId,
    stage: input.stage,
    model: input.model,
    imageDetail: input.imageDetail,
    reasoningEffort: input.reasoningEffort,
    imageCount: input.imageCount,
  });
}

export function attachStageToApiError(
  wrappedError: ScreenshotReviewApiError,
  stage: PipelineStage
): ScreenshotReviewApiError {
  if (process.env.NODE_ENV !== "development") {
    return wrappedError;
  }

  return {
    error: {
      ...wrappedError.error,
      stage,
    },
  };
}

export function pipelineFailure(
  tracker: PipelineStageTracker,
  wrappedError: ScreenshotReviewApiError
): { ok: false; error: ScreenshotReviewApiError } {
  return { ok: false, error: attachStageToApiError(wrappedError, tracker.stage) };
}

export function logStageComplete(input: {
  requestId: string;
  stage: "observer" | "reviewer" | "critic" | "rewrite";
  durationMs: number;
  success: boolean;
}): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[screenshot-review:stage-complete]", input);
}

export function logPipelineComplete(input: {
  requestId: string;
  totalDurationMs: number;
  observerDurationMs: number;
  reviewerDurationMs: number;
  criticDurationMs: number;
  rewriteDurationMs: number;
  wasRewritten: boolean;
  success: boolean;
}): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[screenshot-review:complete]", input);
}
