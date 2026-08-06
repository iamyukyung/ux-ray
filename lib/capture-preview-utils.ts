import type { ScreenshotReviewReport } from "@/lib/types";

/** URL 리뷰 — report.source.deviceType 기준 */
export function isUrlMobileCapture(report: ScreenshotReviewReport): boolean {
  return report.source?.deviceType === "mobile";
}

export const MOBILE_CAPTURE_PREVIEW_MAX_WIDTH_CLASS = "max-w-[300px]";
export const MOBILE_CAPTURE_PREVIEW_FRAME_CLASS =
  "max-h-[min(520px,65vh)] max-sm:max-h-[60vh]";
