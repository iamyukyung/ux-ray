import OpenAI, {
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  postprocessScreenshotAnalysis,
} from "@/lib/ai/postprocess-screenshot-analysis";
import {
  readImageDimensionsFromBuffer,
  sha256Prefix,
} from "@/lib/ai/image-buffer-utils";
import {
  buildScreenMetadataPrompt,
  buildScreenshotReviewContextPrompt,
  SCREENSHOT_REVIEW_SYSTEM_PROMPT,
  type ScreenshotReviewPromptContext,
} from "@/lib/ai/prompts/screenshot-review";
import {
  ScreenshotAnalysisSchema,
  type ScreenshotAnalysis,
} from "@/lib/ai/schemas/screenshot-analysis";
import type {
  DeviceType,
  ReviewLens,
  ScreenReference,
  ScreenshotReviewDebugInfo,
  ScreenshotReviewMode,
  ScreenshotReviewReport,
  ScreenshotVisualEvidence,
  UrlReviewSource,
} from "@/lib/types";
import type { UrlDomSnapshot } from "@/lib/capture/url-types";
import { SCREEN_DEVICE_LABELS } from "@/lib/types";
import { z } from "zod";

export type ScreenshotReviewErrorCode =
  | "INVALID_INPUT"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_IMAGES"
  | "UNSUPPORTED_FILE"
  | "AI_NOT_CONFIGURED"
  | "AI_RATE_LIMITED"
  | "AI_TIMEOUT"
  | "PIPELINE_TIMEOUT"
  | "AI_REFUSAL"
  | "INVALID_AI_RESPONSE"
  | "INTERNAL_ERROR";

export interface ScreenshotReviewApiError {
  error: {
    code: ScreenshotReviewErrorCode;
    message: string;
    stage?: import("@/lib/ai/pipeline/pipeline-stage").PipelineStage;
  };
}

export interface ValidatedScreenshotInput {
  metadata: ScreenshotReviewMetadata;
  images: ValidatedScreenshotImage[];
  urlContext?: UrlReviewPipelineContext;
}

export interface UrlReviewPipelineContext {
  requestedUrl: string;
  finalUrl: string;
  pageTitle: string | null;
  deviceType: "desktop" | "mobile";
  domSnapshot: UrlDomSnapshot;
}

export interface ScreenshotReviewMetadata {
  reviewMode: ScreenshotReviewMode;
  reviewLens: ReviewLens;
  sourceType?: "screenshots" | "url";
  urlSource?: UrlReviewSource;
  projectName?: string;
  userGoal?: string;
  targetUser?: string;
  focusArea?: string;
  screens: ScreenshotReviewScreenMeta[];
}

export interface ScreenshotReviewScreenMeta {
  id: string;
  screenName: string;
  deviceType: DeviceType;
  width: number;
  height: number;
  order: number;
}

export interface ValidatedScreenshotImage {
  buffer: Buffer;
  mimeType: string;
  size: number;
  sha256Prefix: string;
  serverWidth?: number;
  serverHeight?: number;
}

export interface ScreenshotReviewAnalysisResult {
  report: ScreenshotReviewReport;
  debug: ScreenshotReviewDebugInfo;
}

const MAX_UPLOAD_COUNT = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const ScreenMetaSchema = z.object({
  id: z.string().trim().min(1),
  screenName: z.string().trim().min(1),
  deviceType: z.enum(["desktop", "mobile", "tablet", "custom"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  order: z.number().int().min(0),
});

const MetadataSchema = z.object({
  reviewMode: z.enum(["single-screen", "user-flow"]),
  reviewLens: z.enum(["general", "norman"]).optional(),
  projectName: z.string().optional(),
  userGoal: z.string().optional(),
  targetUser: z.string().optional(),
  focusArea: z.string().optional(),
  screens: z.array(ScreenMetaSchema).min(1).max(MAX_UPLOAD_COUNT),
});

import { getAiModelConfig } from "@/lib/ai/config";

export function apiError(code: ScreenshotReviewErrorCode, message: string): ScreenshotReviewApiError {
  return { error: { code, message } };
}

function inferMimeType(file: File): string | null {
  if (ACCEPTED_IMAGE_TYPES.has(file.type)) return file.type;

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".webp")) return "image/webp";
  return null;
}

function normalizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveImageDetail(): "low" | "high" | "original" | "auto" {
  return getAiModelConfig().imageDetail;
}

export async function parseScreenshotReviewRequest(
  formData: FormData
): Promise<{ ok: true; value: ValidatedScreenshotInput } | { ok: false; error: ScreenshotReviewApiError }> {
  const metadataRaw = formData.get("metadata");
  if (typeof metadataRaw !== "string" || !metadataRaw.trim()) {
    return {
      ok: false,
      error: apiError("INVALID_INPUT", "리뷰 정보가 올바르지 않아요. 다시 시도해주세요."),
    };
  }

  let metadataJson: unknown;
  try {
    metadataJson = JSON.parse(metadataRaw);
  } catch {
    return {
      ok: false,
      error: apiError("INVALID_INPUT", "리뷰 정보 형식이 올바르지 않아요."),
    };
  }

  const parsedMetadata = MetadataSchema.safeParse(metadataJson);
  if (!parsedMetadata.success) {
    return {
      ok: false,
      error: apiError("INVALID_INPUT", "화면 정보를 다시 확인해주세요."),
    };
  }

  const imageEntries = formData.getAll("images");
  if (imageEntries.length === 0) {
    return {
      ok: false,
      error: apiError("INVALID_INPUT", "분석할 이미지를 업로드해주세요."),
    };
  }

  if (imageEntries.length > MAX_UPLOAD_COUNT) {
    return {
      ok: false,
      error: apiError("TOO_MANY_IMAGES", `이미지는 최대 ${MAX_UPLOAD_COUNT}개까지 업로드할 수 있어요.`),
    };
  }

  const screens = [...parsedMetadata.data.screens].sort((a, b) => a.order - b.order);
  const screenIds = screens.map((screen) => screen.id);
  if (new Set(screenIds).size !== screenIds.length) {
    return {
      ok: false,
      error: apiError("INVALID_INPUT", "화면 정보에 중복이 있어요. 다시 확인해주세요."),
    };
  }

  if (imageEntries.length !== screens.length) {
    return {
      ok: false,
      error: apiError("INVALID_INPUT", "업로드한 이미지 수와 화면 정보가 일치하지 않아요."),
    };
  }

  const expectedReviewMode =
    screens.length === 1 ? "single-screen" : "user-flow";
  if (parsedMetadata.data.reviewMode !== expectedReviewMode) {
    return {
      ok: false,
      error: apiError("INVALID_INPUT", "리뷰 유형 정보가 올바르지 않아요."),
    };
  }

  const images: ValidatedScreenshotImage[] = [];

  for (const entry of imageEntries) {
    if (!(entry instanceof File)) {
      return {
        ok: false,
        error: apiError("INVALID_INPUT", "이미지 파일 형식이 올바르지 않아요."),
      };
    }

    if (entry.size === 0) {
      return {
        ok: false,
        error: apiError("INVALID_INPUT", "비어 있는 이미지 파일은 업로드할 수 없어요."),
      };
    }

    if (entry.size > MAX_FILE_SIZE_BYTES) {
      return {
        ok: false,
        error: apiError("FILE_TOO_LARGE", `${entry.name}: 파일당 10MB 이하만 업로드할 수 있어요.`),
      };
    }

    const mimeType = inferMimeType(entry);
    if (!mimeType) {
      return {
        ok: false,
        error: apiError("UNSUPPORTED_FILE", `${entry.name}: PNG, JPG, WebP 형식만 업로드할 수 있어요.`),
      };
    }

    const buffer = Buffer.from(await entry.arrayBuffer());
    if (buffer.byteLength === 0) {
      return {
        ok: false,
        error: apiError("INVALID_INPUT", "비어 있는 이미지 파일은 업로드할 수 없어요."),
      };
    }

    const dimensions = readImageDimensionsFromBuffer(buffer, mimeType);

    images.push({
      buffer,
      mimeType,
      size: buffer.byteLength,
      sha256Prefix: sha256Prefix(buffer),
      serverWidth: dimensions?.width,
      serverHeight: dimensions?.height,
    });
  }

  const enrichedScreens = screens.map((screen, index) => {
    const image = images[index];
    if (!image) return screen;

    return {
      ...screen,
      width: image.serverWidth ?? screen.width,
      height: image.serverHeight ?? screen.height,
    };
  });

  const metadata: ScreenshotReviewMetadata = {
    reviewMode: parsedMetadata.data.reviewMode,
    reviewLens: parsedMetadata.data.reviewLens ?? "general",
    projectName: normalizeOptional(parsedMetadata.data.projectName),
    userGoal: normalizeOptional(parsedMetadata.data.userGoal),
    targetUser: normalizeOptional(parsedMetadata.data.targetUser),
    focusArea: normalizeOptional(parsedMetadata.data.focusArea),
    screens: enrichedScreens,
  };

  return { ok: true, value: { metadata, images } };
}

function buildDeviceSummary(screens: ScreenshotReviewScreenMeta[]): string {
  const counts = { desktop: 0, mobile: 0, tablet: 0, custom: 0 };

  for (const screen of screens) {
    counts[screen.deviceType] += 1;
  }

  const parts = (
    Object.entries(counts) as Array<[DeviceType, number]>
  )
    .filter(([, count]) => count > 0)
    .map(([device, count]) => `${SCREEN_DEVICE_LABELS[device]} ${count}개`);

  return parts.join(", ");
}

function defaultProjectName(reviewMode: ScreenshotReviewMode): string {
  return reviewMode === "single-screen" ? "업로드 화면 UX 리뷰" : "업로드 사용자 흐름 UX 리뷰";
}

function buildScreenMap(screens: ScreenshotReviewScreenMeta[]): Map<string, ScreenshotReviewScreenMeta> {
  return new Map(screens.map((screen) => [screen.id, screen]));
}

function sanitizeScreenIds(
  screenIds: string[],
  validIds: Set<string>
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of screenIds) {
    if (!validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  return result;
}

function toScreenReferences(
  screenIds: string[],
  screenMap: Map<string, ScreenshotReviewScreenMeta>
): ScreenReference[] {
  return screenIds
    .map((screenId) => {
      const screen = screenMap.get(screenId);
      if (!screen) return null;
      return {
        screenId,
        screenName: screen.screenName,
        order: screen.order,
      };
    })
    .filter((ref): ref is ScreenReference => ref !== null)
    .sort((a, b) => a.order - b.order);
}

function sanitizeVisualEvidence(
  evidence: ScreenshotAnalysis["issues"][number]["evidence"],
  validIds: Set<string>,
  screenMap: Map<string, ScreenshotReviewScreenMeta>
): ScreenshotVisualEvidence[] {
  const result: ScreenshotVisualEvidence[] = [];
  const seen = new Set<string>();

  for (const item of evidence) {
    if (!validIds.has(item.screenId)) continue;
    const key = `${item.screenId}:${item.observation}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const screen = screenMap.get(item.screenId)!;
    result.push({
      screenId: item.screenId,
      screenName: screen.screenName,
      observation: item.observation,
      confidence: item.confidence,
    });
  }

  return result;
}

export function assembleScreenshotReviewReport(
  metadata: ScreenshotReviewMetadata,
  analysis: ScreenshotAnalysis
): ScreenshotReviewReport {
  const screenMap = buildScreenMap(metadata.screens);
  const validIds = new Set(metadata.screens.map((screen) => screen.id));

  const strengths = analysis.strengths
    .map((strength) => {
      const screenIds = sanitizeScreenIds(strength.screenIds, validIds);
      const screenReferences = toScreenReferences(screenIds, screenMap);
      if (screenReferences.length === 0) return null;
      return {
        title: strength.title,
        description: strength.description,
        screenReferences,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const issues = analysis.issues
    .map((issue) => {
      const evidence = sanitizeVisualEvidence(issue.evidence, validIds, screenMap);
      const evidenceScreenIds = evidence.map((item) => item.screenId);
      const screenIds = sanitizeScreenIds(
        [...new Set([...issue.screenIds, ...evidenceScreenIds])],
        validIds
      );
      const screenReferences = toScreenReferences(screenIds, screenMap);

      if (screenReferences.length === 0 || evidence.length === 0) return null;

      return {
        id: issue.id,
        severity: issue.severity,
        category: issue.category,
        title: issue.title,
        description: issue.description,
        evidence,
        screenReferences,
        expectedImpact: issue.expectedImpact,
        recommendation: issue.recommendation,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const insightEvidence = issues
    .flatMap((issue) => issue.evidence.map((item) => item.observation))
    .slice(0, 5);

  return {
    inputType: "screenshots",
    analysisType: "ai",
    reviewMode: metadata.reviewMode,
    createdAt: new Date().toISOString(),
    projectName: metadata.projectName ?? defaultProjectName(metadata.reviewMode),
    userGoal: metadata.userGoal,
    targetUser: metadata.targetUser,
    focusArea: metadata.focusArea,
    screenCount: metadata.screens.length,
    deviceSummary: buildDeviceSummary(metadata.screens),
    insight: {
      summary: analysis.summary,
      confidence: analysis.overallConfidence,
      evidence: insightEvidence.length > 0 ? insightEvidence : [analysis.summary],
    },
    strengths,
    issues,
    limitations: analysis.limitations,
  };
}

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

type OpenAIInputContent =
  | { type: "input_text"; text: string }
  | {
      type: "input_image";
      image_url: string;
      detail: "low" | "high" | "original" | "auto";
    };

function buildOpenAIInput(
  context: ScreenshotReviewPromptContext,
  images: ValidatedScreenshotImage[]
): OpenAI.Responses.ResponseCreateParams["input"] {
  const content: OpenAIInputContent[] = [
    {
      type: "input_text",
      text: buildScreenshotReviewContextPrompt(context),
    },
  ];

  const totalScreens = context.screens.length;

  for (let index = 0; index < context.screens.length; index += 1) {
    const screen = context.screens[index]!;
    const image = images[index]!;

    content.push({
      type: "input_image",
      image_url: bufferToDataUrl(image.buffer, image.mimeType),
      detail: resolveImageDetail(),
    });
    content.push({
      type: "input_text",
      text: buildScreenMetadataPrompt(screen, totalScreens, {
        byteSize: image.size,
        serverWidth: image.serverWidth,
        serverHeight: image.serverHeight,
      }),
    });
  }

  return [{ role: "user", content }];
}

function hasRefusalOutput(response: OpenAI.Responses.Response): boolean {
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "refusal") return true;
    }
  }
  return false;
}

export function classifyScreenshotReviewError(error: unknown): ScreenshotReviewApiError {
  if (error instanceof AuthenticationError) {
    return apiError("AI_NOT_CONFIGURED", "AI 분석 설정을 확인할 수 없어요. 잠시 후 다시 시도해주세요.");
  }

  if (error instanceof RateLimitError) {
    return apiError("AI_RATE_LIMITED", "AI 분석 요청이 많아 잠시 후 다시 시도해주세요.");
  }

  if (error instanceof APIConnectionTimeoutError) {
    return apiError("AI_TIMEOUT", "AI 분석 시간이 초과되었어요. 잠시 후 다시 시도해주세요.");
  }

  if (error instanceof APIError) {
    const nested = error.error as { code?: string; type?: string } | undefined;
    const code = nested?.code ?? error.code ?? "";

    if (error.status === 429 || code === "insufficient_quota" || code === "billing_hard_limit_reached") {
      return apiError("AI_RATE_LIMITED", "AI 분석 요청이 많아 잠시 후 다시 시도해주세요.");
    }
  }

  return apiError("INTERNAL_ERROR", "AI 리뷰를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
}

export function logScreenshotReviewImages(
  requestId: string,
  images: ValidatedScreenshotImage[]
): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info(
    "[screenshot-review]",
    {
      requestId,
      images: images.map((image, index) => ({
        index,
        mimeType: image.mimeType,
        byteSize: image.size,
        sha256Prefix: image.sha256Prefix,
        serverWidth: image.serverWidth,
        serverHeight: image.serverHeight,
      })),
    }
  );
}

export async function analyzeScreenshotsWithOpenAI(
  input: ValidatedScreenshotInput,
  requestId: string,
  deadline: import("@/lib/ai/pipeline/pipeline-timeout").PipelineDeadlineContext,
  stageTracker?: import("@/lib/ai/pipeline/pipeline-stage").PipelineStageTracker
): Promise<
  { ok: true; result: ScreenshotReviewAnalysisResult } | { ok: false; error: ScreenshotReviewApiError }
> {
  const { runScreenshotPipelineV2 } = await import("@/lib/ai/pipeline/run-screenshot-pipeline-v2");
  return runScreenshotPipelineV2(input, requestId, deadline, stageTracker);
}

/** Pipeline 1.0 — 개발 환경 비교 테스트 전용 */
export async function analyzeScreenshotsWithOpenAI_v1(
  input: ValidatedScreenshotInput,
  requestId: string
): Promise<
  { ok: true; result: ScreenshotReviewAnalysisResult } | { ok: false; error: ScreenshotReviewApiError }
> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: apiError("AI_NOT_CONFIGURED", "AI 분석 설정을 확인할 수 없어요. 잠시 후 다시 시도해주세요."),
    };
  }

  const model = process.env.OPENAI_VISION_MODEL || "gpt-5.6-terra";
  const client = new OpenAI({ apiKey, timeout: 85_000 });

  const promptContext: ScreenshotReviewPromptContext = {
    reviewMode: input.metadata.reviewMode,
    projectName: input.metadata.projectName,
    userGoal: input.metadata.userGoal,
    targetUser: input.metadata.targetUser,
    focusArea: input.metadata.focusArea,
    screens: input.metadata.screens,
  };

  try {
    const response = await client.responses.parse({
      model,
      instructions: SCREENSHOT_REVIEW_SYSTEM_PROMPT,
      input: buildOpenAIInput(promptContext, input.images),
      store: false,
      text: {
        format: zodTextFormat(ScreenshotAnalysisSchema, "screenshot_analysis"),
      },
    });

    if (hasRefusalOutput(response)) {
      return {
        ok: false,
        error: apiError("AI_REFUSAL", "업로드한 화면을 분석할 수 없어요. 다른 화면으로 다시 시도해주세요."),
      };
    }

    const analysis = response.output_parsed;
    if (!analysis) {
      return {
        ok: false,
        error: apiError("INVALID_AI_RESPONSE", "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요."),
      };
    }

    const aiIssueCount = analysis.issues.length;
    const processed = postprocessScreenshotAnalysis(analysis, input.metadata);
    const report = assembleScreenshotReviewReport(input.metadata, processed);

    if (report.issues.length === 0) {
      return {
        ok: false,
        error: apiError("INVALID_AI_RESPONSE", "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요."),
      };
    }

    return {
      ok: true,
      result: {
        report,
        debug: {
          requestId,
          source: "ai",
          aiIssueCount,
          renderedIssueCount: report.issues.length,
          analysisType: "ai",
        },
      },
    };
  } catch (error) {
    return { ok: false, error: classifyScreenshotReviewError(error) };
  }
}
