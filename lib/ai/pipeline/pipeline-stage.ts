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
  /** 비동기 잡 상태 저장 등, stage 전환마다 부수 작업이 필요할 때 사용합니다. */
  onStageChange?: (stage: PipelineStage) => void;
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
  tracker.onStageChange?.(stage);
}

export interface ClientApiErrorBody {
  code: string;
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
  overviewImageDetail: ImageDetail;
  cropImageDetail: ImageDetail;
  reasoningEffort: ReasoningEffort;
  overviewImageCount: number;
  cropImageCount: number;
}): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[screenshot-review:openai-prep]", {
    requestId: input.requestId,
    stage: input.stage,
    model: input.model,
    overviewImageDetail: input.overviewImageDetail,
    cropImageDetail: input.cropImageDetail,
    reasoningEffort: input.reasoningEffort,
    overviewImageCount: input.overviewImageCount,
    cropImageCount: input.cropImageCount,
    imageCount: input.overviewImageCount + input.cropImageCount,
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

export function logPostprocessDiagnostics(input: {
  requestId: string;
  phase: "initial" | "rewrite";
  aiIssueCount: number;
  aiEvidenceCount: number;
  validEvidenceCount: number;
  remappedToOverviewCount: number;
  droppedEvidenceCount: number;
  droppedIssueCount: number;
  finalIssueCount: number;
}): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[screenshot-review:postprocess]", input);
}

export function logCriticResult(input: {
  requestId: string;
  approved: boolean;
  problemTypes: string[];
  problemCount: number;
  missingHighValueFindingCount: number;
  rewriteInstructionCount: number;
}): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[screenshot-review:critic-result]", input);
}

export function logRewriteFallback(input: {
  requestId: string;
  initialValidIssueCount: number;
  rewrittenAiIssueCount: number;
  rewrittenValidIssueCount: number;
  reason: string;
}): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[screenshot-review:rewrite-fallback]", input);
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
  reviewLens?: import("@/lib/types").ReviewLens;
  principleTaggedIssueCount?: number;
}): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[screenshot-review:complete]", input);
}
