import type {
  ScreenshotReviewContext,
  ScreenshotReviewDebugInfo,
  ScreenshotReviewReport,
} from "@/lib/types";
import { isCompletePipelineReport } from "@/lib/ai/pipeline/report-validation";
import { buildScreenshotReviewContext, sortScreensByOrder } from "@/lib/screenshot-review-utils";

export type ScreenshotReviewClientErrorCode =
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
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"
  | "ABORTED";

export class ScreenshotReviewRequestError extends Error {
  readonly code: ScreenshotReviewClientErrorCode;
  readonly stage?: string;

  constructor(code: ScreenshotReviewClientErrorCode, message: string, stage?: string) {
    super(message);
    this.name = "ScreenshotReviewRequestError";
    this.code = code;
    this.stage = stage;
  }
}

export interface ScreenshotReviewResponse {
  report: ScreenshotReviewReport;
  debug?: ScreenshotReviewDebugInfo;
}

const REQUEST_TIMEOUT_MS = 630_000;

const ERROR_MESSAGES: Record<ScreenshotReviewClientErrorCode, string> = {
  INVALID_INPUT: "입력한 화면 정보를 다시 확인해주세요.",
  FILE_TOO_LARGE: "파일 크기 제한을 초과했어요. 10MB 이하 이미지만 업로드해주세요.",
  TOO_MANY_IMAGES: "업로드 가능한 이미지 개수를 초과했어요.",
  UNSUPPORTED_FILE: "지원하지 않는 이미지 형식이에요. PNG, JPG, WebP만 업로드해주세요.",
  AI_NOT_CONFIGURED: "AI 분석을 시작할 수 없어요. 잠시 후 다시 시도해주세요.",
  AI_RATE_LIMITED: "AI 분석 요청이 많아 잠시 후 다시 시도해주세요.",
  AI_TIMEOUT: "AI 분석 시간이 초과되었어요. 잠시 후 다시 시도해주세요.",
  PIPELINE_TIMEOUT: "AI 리뷰 생성 시간이 초과됐어요.",
  AI_REFUSAL: "업로드한 화면을 분석할 수 없어요. 다른 화면으로 다시 시도해주세요.",
  INVALID_AI_RESPONSE: "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요.",
  INTERNAL_ERROR: "AI 리뷰를 만들지 못했어요. 잠시 후 다시 시도해주세요.",
  NETWORK_ERROR: "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
  ABORTED: "요청이 취소되었어요.",
};

let inFlightController: AbortController | null = null;

function buildMetadata(context: ScreenshotReviewContext) {
  const screens = sortScreensByOrder(context.screens);

  return {
    reviewMode: context.reviewMode,
    projectName: context.projectName,
    userGoal: context.userGoal,
    targetUser: context.targetUser,
    focusArea: context.focusArea,
    screens: screens.map((screen) => ({
      id: screen.id,
      screenName: screen.screenName.trim(),
      deviceType: screen.deviceType,
      width: screen.width,
      height: screen.height,
      order: screen.order,
    })),
  };
}

function mapServerErrorCode(code: string): ScreenshotReviewClientErrorCode {
  if (code in ERROR_MESSAGES) {
    return code as ScreenshotReviewClientErrorCode;
  }
  return "INTERNAL_ERROR";
}

export function getScreenshotReviewErrorMessage(code: ScreenshotReviewClientErrorCode): string {
  return ERROR_MESSAGES[code];
}

export function cancelScreenshotReviewRequest(): void {
  inFlightController?.abort();
  inFlightController = null;
}

export async function createScreenshotReview(
  context: ScreenshotReviewContext
): Promise<ScreenshotReviewResponse> {
  if (inFlightController) {
    throw new ScreenshotReviewRequestError("INTERNAL_ERROR", "이미 분석 요청이 진행 중입니다.");
  }

  const controller = new AbortController();
  inFlightController = controller;

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const formData = new FormData();
    const screens = sortScreensByOrder(context.screens);

    for (const screen of screens) {
      if (!screen.file || screen.file.size === 0) {
        throw new ScreenshotReviewRequestError(
          "INVALID_INPUT",
          `${screen.screenName}: 유효하지 않은 이미지 파일입니다.`
        );
      }
      formData.append("images", screen.file, screen.fileName);
    }

    formData.append("metadata", JSON.stringify(buildMetadata(context)));

    const response = await fetch("/api/reviews/screenshots", {
      method: "POST",
      body: formData,
      signal: controller.signal,
      cache: "no-store",
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ScreenshotReviewRequestError("NETWORK_ERROR", ERROR_MESSAGES.NETWORK_ERROR);
    }

    if (!response.ok) {
      const errorPayload = payload as {
        error?: { code?: string; message?: string; stage?: string };
      };
      const code = mapServerErrorCode(errorPayload.error?.code ?? "INTERNAL_ERROR");
      const message = errorPayload.error?.message ?? ERROR_MESSAGES[code];
      throw new ScreenshotReviewRequestError(code, message, errorPayload.error?.stage);
    }

    const result = payload as { report?: ScreenshotReviewReport; _debug?: ScreenshotReviewDebugInfo };
    if (!result.report || !isCompletePipelineReport(result.report)) {
      throw new ScreenshotReviewRequestError("INVALID_AI_RESPONSE", ERROR_MESSAGES.INVALID_AI_RESPONSE);
    }

    return {
      report: result.report,
      debug: result._debug,
    };
  } catch (error) {
    if (error instanceof ScreenshotReviewRequestError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ScreenshotReviewRequestError("PIPELINE_TIMEOUT", ERROR_MESSAGES.PIPELINE_TIMEOUT);
    }

    throw new ScreenshotReviewRequestError("NETWORK_ERROR", ERROR_MESSAGES.NETWORK_ERROR);
  } finally {
    window.clearTimeout(timeoutId);
    if (inFlightController === controller) {
      inFlightController = null;
    }
  }
}
