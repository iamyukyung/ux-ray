export type ImageDetail = "low" | "high" | "original" | "auto";

export type ReasoningEffort =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export type PipelineStageReasoning =
  | "observer"
  | "reviewer"
  | "critic"
  | "rewrite";

const ALLOWED_IMAGE_DETAILS = new Set<string>(["low", "high", "original", "auto"]);

const ALLOWED_REASONING_EFFORTS = new Set<string>([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

export const PIPELINE_VERSION = "2.0" as const;

const TIMEOUT_MIN_MS = 60_000;
const TIMEOUT_MAX_MS = 600_000;
const DEFAULT_TIMEOUT_DEV_MS = 420_000;
const DEFAULT_TIMEOUT_PROD_MS = 240_000;

/** Next.js route segment config requires a static literal (max env timeout + 15s buffer). */
export const SCREENSHOT_REVIEW_ROUTE_MAX_DURATION = 615;

export interface AiModelConfig {
  observerModel: string;
  reviewerModel: string;
  criticModel: string;
  imageDetail: ImageDetail;
  observerReasoningEffort: ReasoningEffort;
  reviewerReasoningEffort: ReasoningEffort;
  criticReasoningEffort: ReasoningEffort;
  rewriteReasoningEffort: ReasoningEffort;
}

function resolveImageDetail(): ImageDetail {
  const configured = process.env.OPENAI_IMAGE_DETAIL?.trim();
  if (configured && ALLOWED_IMAGE_DETAILS.has(configured)) {
    return configured as ImageDetail;
  }
  return "original";
}

function resolveReasoningEffort(
  stageEnvVar: string | undefined,
  fallback: ReasoningEffort
): ReasoningEffort {
  const globalFallback = process.env.OPENAI_REASONING_EFFORT?.trim();
  const configured = stageEnvVar?.trim() || globalFallback;

  if (configured && ALLOWED_REASONING_EFFORTS.has(configured)) {
    return configured as ReasoningEffort;
  }

  return fallback;
}

export function getScreenshotReviewTimeoutMs(): number {
  const configured = process.env.SCREENSHOT_REVIEW_TIMEOUT_MS?.trim();
  if (configured) {
    const parsed = Number.parseInt(configured, 10);
    if (Number.isFinite(parsed) && parsed >= TIMEOUT_MIN_MS && parsed <= TIMEOUT_MAX_MS) {
      return parsed;
    }
  }

  return process.env.NODE_ENV === "development"
    ? DEFAULT_TIMEOUT_DEV_MS
    : DEFAULT_TIMEOUT_PROD_MS;
}

export function getRouteMaxDurationSeconds(): number {
  return SCREENSHOT_REVIEW_ROUTE_MAX_DURATION;
}

/** Centralized OpenAI model and pipeline settings for screenshot review. */
export function getAiModelConfig(): AiModelConfig {
  return {
    observerModel: process.env.OPENAI_OBSERVER_MODEL?.trim() || "gpt-5.6-terra",
    reviewerModel: process.env.OPENAI_REVIEWER_MODEL?.trim() || "gpt-5.6-sol",
    criticModel: process.env.OPENAI_CRITIC_MODEL?.trim() || "gpt-5.6-sol",
    imageDetail: resolveImageDetail(),
    observerReasoningEffort: resolveReasoningEffort(
      process.env.OPENAI_OBSERVER_REASONING_EFFORT,
      "medium"
    ),
    reviewerReasoningEffort: resolveReasoningEffort(
      process.env.OPENAI_REVIEWER_REASONING_EFFORT,
      "high"
    ),
    criticReasoningEffort: resolveReasoningEffort(
      process.env.OPENAI_CRITIC_REASONING_EFFORT,
      "medium"
    ),
    rewriteReasoningEffort: resolveReasoningEffort(
      process.env.OPENAI_REWRITE_REASONING_EFFORT,
      "high"
    ),
  };
}

export function getReasoningEffortForStage(
  config: AiModelConfig,
  stage: PipelineStageReasoning
): ReasoningEffort {
  switch (stage) {
    case "observer":
      return config.observerReasoningEffort;
    case "reviewer":
      return config.reviewerReasoningEffort;
    case "critic":
      return config.criticReasoningEffort;
    case "rewrite":
      return config.rewriteReasoningEffort;
  }
}
