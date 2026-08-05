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
  /** @deprecated v1(legacy) 비교 파이프라인 전용 — 프로덕션 v2 파이프라인은 overviewImageDetail/cropImageDetail을 사용합니다. */
  imageDetail: ImageDetail;
  /** 화면 전체 개요 이미지 detail — 텍스트 판독보다 레이아웃 파악이 목적이라 low가 기본값입니다. */
  overviewImageDetail: ImageDetail;
  /** Observer가 지목한 crop(확대본) detail — 세부 판독이 필요해 high가 기본값입니다. */
  cropImageDetail: ImageDetail;
  observerReasoningEffort: ReasoningEffort;
  reviewerReasoningEffort: ReasoningEffort;
  criticReasoningEffort: ReasoningEffort;
  rewriteReasoningEffort: ReasoningEffort;
}

function resolveImageDetailSetting(
  envVar: string | undefined,
  fallback: ImageDetail
): ImageDetail {
  const configured = envVar?.trim();
  if (configured && ALLOWED_IMAGE_DETAILS.has(configured)) {
    return configured as ImageDetail;
  }
  return fallback;
}

function resolveImageDetail(): ImageDetail {
  return resolveImageDetailSetting(process.env.OPENAI_IMAGE_DETAIL, "original");
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
    overviewImageDetail: resolveImageDetailSetting(
      process.env.OPENAI_OVERVIEW_IMAGE_DETAIL,
      "low"
    ),
    cropImageDetail: resolveImageDetailSetting(process.env.OPENAI_CROP_IMAGE_DETAIL, "high"),
    observerReasoningEffort: resolveReasoningEffort(
      process.env.OPENAI_OBSERVER_REASONING_EFFORT,
      "high"
    ),
    reviewerReasoningEffort: resolveReasoningEffort(
      process.env.OPENAI_REVIEWER_REASONING_EFFORT,
      "medium"
    ),
    criticReasoningEffort: resolveReasoningEffort(
      process.env.OPENAI_CRITIC_REASONING_EFFORT,
      "medium"
    ),
    rewriteReasoningEffort: resolveReasoningEffort(
      process.env.OPENAI_REWRITE_REASONING_EFFORT,
      "medium"
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
