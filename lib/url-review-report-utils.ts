import type { ScreenshotReviewReport } from "@/lib/types";

export function isUrlReviewReport(
  report: ScreenshotReviewReport | null | undefined
): report is ScreenshotReviewReport {
  if (!report) return false;
  return report.sourceType === "url" || report.inputType === "url";
}

export function buildScreenAssetKey(reviewId: string, screenId: string): string {
  return `${reviewId}:${screenId}`;
}

export class UrlReviewAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlReviewAssetError";
  }
}

function devLog(event: string, payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "development") {
    console.info(event, payload);
  }
}
