import type { ScreenshotReviewContext } from "./types";

const store = new Map<string, ScreenshotReviewContext>();

export function setScreenshotReviewContext(
  reviewId: string,
  context: ScreenshotReviewContext
): void {
  const existing = store.get(reviewId);
  if (existing) {
    revokePreviewUrls(existing);
  }
  store.set(reviewId, context);
}

export function getScreenshotReviewContext(
  reviewId: string
): ScreenshotReviewContext | undefined {
  return store.get(reviewId);
}

export function clearScreenshotReviewContext(reviewId: string): void {
  const context = store.get(reviewId);
  if (context) {
    revokePreviewUrls(context);
  }
  store.delete(reviewId);
}

function revokePreviewUrls(context: ScreenshotReviewContext): void {
  for (const screen of context.screens) {
    URL.revokeObjectURL(screen.previewUrl);
  }
}
