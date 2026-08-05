import { assertSafePublicUrl, normalizePublicUrl } from "@/lib/capture/validate-public-url";
import { UrlReviewError } from "@/lib/capture/url-review-errors";
import { CaptureError } from "./capture-errors";

/** http/https 공개 URL만 허용하고, SSRF 위험 주소를 차단합니다. */
export function assertSafeCaptureUrl(rawUrl: string): URL {
  try {
    return assertSafePublicUrl(rawUrl) as unknown as URL;
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    if (error instanceof UrlReviewError) {
      throw new CaptureError(
        error.code === "PRIVATE_ADDRESS_BLOCKED" || error.code === "UNSAFE_REDIRECT"
          ? "BLOCKED_URL"
          : "INVALID_URL",
        error.message,
        error.status
      );
    }
    throw new CaptureError("INVALID_URL", "올바른 URL을 입력해주세요.");
  }
}

export function normalizeCaptureUrl(rawUrl: string): string {
  return normalizePublicUrl(rawUrl).toString();
}

export { assertSafePublicUrl, normalizePublicUrl };
