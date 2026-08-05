import type {
  ScreenshotReviewDebugInfo,
  ScreenshotReviewReport,
} from "@/lib/types";
import type { UrlReviewRequest } from "@/lib/capture/url-types";
import { URL_REVIEW_ERROR_MESSAGES } from "@/lib/capture/url-review-errors";
import { isCompletePipelineReport } from "@/lib/ai/pipeline/report-validation";

export type UrlReviewClientErrorCode =
  | keyof typeof URL_REVIEW_ERROR_MESSAGES
  | "NETWORK_ERROR"
  | "ABORTED";

export class UrlReviewRequestError extends Error {
  readonly code: UrlReviewClientErrorCode;
  readonly stage?: string;

  constructor(code: UrlReviewClientErrorCode, message: string, stage?: string) {
    super(message);
    this.name = "UrlReviewRequestError";
    this.code = code;
    this.stage = stage;
  }
}

export interface UrlReviewResponse {
  report: ScreenshotReviewReport;
  debug?: ScreenshotReviewDebugInfo;
}

interface UrlReviewStatusResponse {
  status: "processing" | "done" | "error" | "not-found";
  stepIndex?: number;
  report?: ScreenshotReviewReport;
  debug?: ScreenshotReviewDebugInfo;
  error?: { code?: string; message?: string; stage?: string };
}

const POLL_INTERVAL_MS = 2_500;
const MAX_POLL_DURATION_MS = 900_000;

const CLIENT_ERROR_MESSAGES: Record<UrlReviewClientErrorCode, string> = {
  ...URL_REVIEW_ERROR_MESSAGES,
  NETWORK_ERROR: "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
  ABORTED: "요청이 취소되었어요.",
};

let inFlightController: AbortController | null = null;

function mapServerErrorCode(code: string): UrlReviewClientErrorCode {
  if (code in CLIENT_ERROR_MESSAGES) {
    return code as UrlReviewClientErrorCode;
  }
  return "INTERNAL_ERROR";
}

export function getUrlReviewErrorMessage(code: UrlReviewClientErrorCode): string {
  return CLIENT_ERROR_MESSAGES[code];
}

export function cancelUrlReviewRequest(): void {
  inFlightController?.abort();
  inFlightController = null;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function startUrlReviewJob(
  request: UrlReviewRequest,
  signal: AbortSignal
): Promise<string> {
  const response = await fetch("/api/reviews/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
    cache: "no-store",
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new UrlReviewRequestError("NETWORK_ERROR", CLIENT_ERROR_MESSAGES.NETWORK_ERROR);
  }

  if (!response.ok) {
    const errorPayload = payload as {
      error?: { code?: string; message?: string; stage?: string };
    };
    const code = mapServerErrorCode(errorPayload.error?.code ?? "INTERNAL_ERROR");
    const message = errorPayload.error?.message ?? CLIENT_ERROR_MESSAGES[code];
    throw new UrlReviewRequestError(code, message, errorPayload.error?.stage);
  }

  const result = payload as { reviewId?: string };
  if (!result.reviewId) {
    throw new UrlReviewRequestError("INTERNAL_ERROR", "리뷰 요청을 시작하지 못했습니다.");
  }

  return result.reviewId;
}

async function pollUrlReviewJob(
  reviewId: string,
  signal: AbortSignal,
  onProgress: (stepIndex: number) => void
): Promise<UrlReviewResponse> {
  const startedAt = Date.now();

  for (;;) {
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
      throw new UrlReviewRequestError("PIPELINE_TIMEOUT", CLIENT_ERROR_MESSAGES.PIPELINE_TIMEOUT);
    }

    const response = await fetch(`/api/reviews/url/${reviewId}`, {
      signal,
      cache: "no-store",
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new UrlReviewRequestError("NETWORK_ERROR", CLIENT_ERROR_MESSAGES.NETWORK_ERROR);
    }

    if (response.status === 404) {
      throw new UrlReviewRequestError("INTERNAL_ERROR", "리뷰 요청을 찾을 수 없습니다.");
    }

    const result = payload as UrlReviewStatusResponse;

    if (result.status === "processing") {
      if (typeof result.stepIndex === "number") {
        onProgress(result.stepIndex);
      }
      await delay(POLL_INTERVAL_MS, signal);
      continue;
    }

    if (result.status === "error") {
      const code = mapServerErrorCode(result.error?.code ?? "INTERNAL_ERROR");
      const message = result.error?.message ?? CLIENT_ERROR_MESSAGES[code];
      throw new UrlReviewRequestError(code, message, result.error?.stage);
    }

    if (!result.report || !isCompletePipelineReport(result.report)) {
      throw new UrlReviewRequestError("INVALID_AI_RESPONSE", CLIENT_ERROR_MESSAGES.INVALID_AI_RESPONSE);
    }

    return { report: result.report, debug: result.debug };
  }
}

/** POST 없이 기존 job id로 폴링 — `/review/[reviewId]` 직접 접근용 */
export async function pollUrlReviewById(
  reviewId: string,
  onProgress?: (stepIndex: number) => void,
  signal?: AbortSignal
): Promise<UrlReviewResponse> {
  const controller = signal ? null : new AbortController();
  const abortSignal = signal ?? controller!.signal;

  return pollUrlReviewJob(reviewId, abortSignal, onProgress ?? (() => {}));
}

export async function createUrlReview(
  request: UrlReviewRequest,
  onProgress?: (stepIndex: number) => void
): Promise<UrlReviewResponse> {
  if (inFlightController) {
    throw new UrlReviewRequestError("INTERNAL_ERROR", "이미 분석 요청이 진행 중입니다.");
  }

  const controller = new AbortController();
  inFlightController = controller;

  try {
    const reviewId = await startUrlReviewJob(request, controller.signal);
    return await pollUrlReviewJob(reviewId, controller.signal, onProgress ?? (() => {}));
  } catch (error) {
    if (error instanceof UrlReviewRequestError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new UrlReviewRequestError("ABORTED", CLIENT_ERROR_MESSAGES.ABORTED);
    }

    throw new UrlReviewRequestError("NETWORK_ERROR", CLIENT_ERROR_MESSAGES.NETWORK_ERROR);
  } finally {
    if (inFlightController === controller) {
      inFlightController = null;
    }
  }
}
