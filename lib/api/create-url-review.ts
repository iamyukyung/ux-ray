import type {
  ScreenshotReviewDebugInfo,
  ScreenshotReviewReport,
  UploadedScreen,
  UrlScreenAssetTransfer,
} from "@/lib/types";
import type { UrlReviewRequest } from "@/lib/capture/url-types";
import { URL_REVIEW_ERROR_MESSAGES } from "@/lib/capture/url-review-errors";
import { isCompletePipelineReport } from "@/lib/ai/pipeline/report-validation";
import {
  ingestUrlReviewScreenAssets,
  loadUrlReportFromSession,
  saveUrlReportToSession,
} from "@/lib/url-review-assets";

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
  reviewId: string;
  report: ScreenshotReviewReport;
  debug?: ScreenshotReviewDebugInfo;
  screens: UploadedScreen[];
}

interface UrlReviewStatusResponse {
  status: "processing" | "done" | "error" | "not-found";
  stepIndex?: number;
  report?: ScreenshotReviewReport;
  debug?: ScreenshotReviewDebugInfo;
  screenAssets?: UrlScreenAssetTransfer[];
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

async function finalizeUrlReviewResponse(
  reviewId: string,
  report: ScreenshotReviewReport,
  debug: ScreenshotReviewDebugInfo | undefined,
  transferAssets: UrlScreenAssetTransfer[]
): Promise<UrlReviewResponse> {
  // 폴링 GET이 status: "done"을 반환한 직후(또는 새로고침 시 session+IndexedDB 복원)에만 실행.
  const ingested = await ingestUrlReviewScreenAssets({
    reviewId,
    report,
    transferAssets,
  });

  return {
    reviewId,
    report: ingested.report,
    debug,
    screens: ingested.screens,
  };
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
      const cachedReport = loadUrlReportFromSession(reviewId);
      if (cachedReport && isCompletePipelineReport(cachedReport)) {
        return finalizeUrlReviewResponse(reviewId, cachedReport, undefined, []);
      }
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

    // POST 202 직후가 아니라, 폴링 GET이 done을 반환한 이 시점에서 screenAssets를 IndexedDB에 저장.
    return finalizeUrlReviewResponse(
      reviewId,
      result.report,
      result.debug,
      result.screenAssets ?? []
    );
  }
}

/** POST 없이 기존 job id로 폴링 — `/review/[reviewId]` 직접 접근용 */
export async function pollUrlReviewById(
  reviewId: string,
  onProgress?: (stepIndex: number) => void,
  signal?: AbortSignal
): Promise<UrlReviewResponse> {
  const cachedReport = loadUrlReportFromSession(reviewId);
  if (cachedReport && isCompletePipelineReport(cachedReport)) {
    return finalizeUrlReviewResponse(reviewId, cachedReport, undefined, []);
  }

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

export { saveUrlReportToSession, loadUrlReportFromSession };
