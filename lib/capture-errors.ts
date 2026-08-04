import type { CaptureErrorCode } from "./capture-types";

export class CaptureError extends Error {
  readonly code: CaptureErrorCode;
  readonly status: number;

  constructor(code: CaptureErrorCode, message: string, status = 400) {
    super(message);
    this.name = "CaptureError";
    this.code = code;
    this.status = status;
  }
}

export function mapPlaywrightError(error: unknown): CaptureError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("err_cert") ||
    lower.includes("ssl") ||
    lower.includes("certificate") ||
    lower.includes("net::err_cert")
  ) {
    return new CaptureError(
      "SSL_ERROR",
      "SSL 인증서 문제로 사이트에 안전하게 접속할 수 없어요. 인증서를 확인해주세요.",
      502
    );
  }

  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("waiting for")
  ) {
    return new CaptureError(
      "TIMEOUT",
      "응답 시간이 초과되었어요. 사이트가 느리거나 일시적으로 접속할 수 없을 수 있어요.",
      504
    );
  }

  if (
    lower.includes("net::err_name_not_resolved") ||
    lower.includes("enotfound") ||
    lower.includes("getaddrinfo")
  ) {
    return new CaptureError(
      "UNREACHABLE",
      "사이트에 접속할 수 없어요. URL이 올바른지 확인해주세요.",
      502
    );
  }

  if (
    lower.includes("net::err_connection_refused") ||
    lower.includes("net::err_connection_reset") ||
    lower.includes("econnrefused") ||
    lower.includes("econnreset")
  ) {
    return new CaptureError(
      "UNREACHABLE",
      "사이트에 연결할 수 없어요. 서버가 응답하지 않거나 접근이 제한되었을 수 있어요.",
      502
    );
  }

  if (lower.includes("navigation") || lower.includes("crashed") || lower.includes("closed")) {
    return new CaptureError(
      "CAPTURE_FAILED",
      "페이지 캡처에 실패했어요. 잠시 후 다시 시도해주세요.",
      500
    );
  }

  return new CaptureError(
    "CAPTURE_FAILED",
    "페이지 캡처 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
    500
  );
}
