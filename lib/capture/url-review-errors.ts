import type { UrlReviewErrorCode } from "@/lib/capture/url-types";

export class UrlReviewError extends Error {
  readonly code: UrlReviewErrorCode;
  readonly status: number;

  constructor(code: UrlReviewErrorCode, message: string, status?: number) {
    super(message);
    this.name = "UrlReviewError";
    this.code = code;
    this.status = status ?? statusForUrlReviewError(code);
  }
}

export function statusForUrlReviewError(code: UrlReviewErrorCode): number {
  switch (code) {
    case "INVALID_URL":
    case "UNSUPPORTED_PROTOCOL":
      return 400;
    case "PRIVATE_ADDRESS_BLOCKED":
    case "UNSAFE_REDIRECT":
      return 403;
    case "CAPTURE_TIMEOUT":
    case "PIPELINE_TIMEOUT":
      return 504;
    case "ACCESS_BLOCKED":
      return 422;
    case "PAGE_UNAVAILABLE":
    case "EMPTY_PAGE":
      return 502;
    case "AI_NOT_CONFIGURED":
      return 503;
    case "INVALID_AI_RESPONSE":
      return 502;
    default:
      return 500;
  }
}

export const URL_REVIEW_ERROR_MESSAGES: Record<UrlReviewErrorCode, string> = {
  INVALID_URL: "올바른 URL을 입력해주세요.",
  UNSUPPORTED_PROTOCOL: "http 또는 https URL만 분석할 수 있어요.",
  PRIVATE_ADDRESS_BLOCKED: "로컬 또는 내부망 주소는 분석할 수 없어요.",
  UNSAFE_REDIRECT: "리다이렉트된 주소는 분석할 수 없어요.",
  CAPTURE_TIMEOUT: "페이지 로딩 시간이 초과됐어요.",
  ACCESS_BLOCKED: "접근이 제한된 페이지예요. 공개 페이지 URL을 입력해주세요.",
  PAGE_UNAVAILABLE: "페이지에 접속할 수 없어요.",
  EMPTY_PAGE: "분석할 수 있는 화면 콘텐츠를 찾지 못했어요.",
  PIPELINE_TIMEOUT: "AI 리뷰 생성 시간이 초과됐어요.",
  AI_NOT_CONFIGURED: "AI 분석을 시작할 수 없어요. 잠시 후 다시 시도해주세요.",
  INVALID_AI_RESPONSE: "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요.",
  INTERNAL_ERROR: "AI 리뷰를 만들지 못했어요. 잠시 후 다시 시도해주세요.",
};
