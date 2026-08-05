import type {
  ReviewMode,
  ScreenshotReviewMode,
  ScreenshotReviewReport,
} from "@/lib/types";
import { getScreenshotReviewMode } from "@/lib/screenshot-review-utils";

const LEGACY_SCREEN_LAYOUT_VALUES = new Set<ScreenshotReviewMode>([
  "single-screen",
  "user-flow",
]);

export function isLegacyScreenLayoutValue(
  value: unknown
): value is ScreenshotReviewMode {
  return (
    typeof value === "string" &&
    LEGACY_SCREEN_LAYOUT_VALUES.has(value as ScreenshotReviewMode)
  );
}

/** 리포트·API에서 reviewMode(quick/precise)를 해석합니다. 없으면 정밀 리뷰로 간주합니다. */
export function resolveReportReviewMode(
  report: Pick<ScreenshotReviewReport, "reviewMode"> & {
    screenLayoutMode?: ScreenshotReviewMode;
  }
): ReviewMode {
  const mode = report.reviewMode;
  if (mode === "quick" || mode === "precise") return mode;
  if (isLegacyScreenLayoutValue(mode)) return "precise";
  return "precise";
}

/** 화면 구성(single-screen / user-flow)을 해석합니다. */
export function resolveReportScreenLayoutMode(
  report: Pick<ScreenshotReviewReport, "screenCount"> & {
    screenLayoutMode?: ScreenshotReviewMode;
    reviewMode?: ReviewMode | ScreenshotReviewMode;
  }
): ScreenshotReviewMode {
  if (report.screenLayoutMode) return report.screenLayoutMode;
  if (isLegacyScreenLayoutValue(report.reviewMode)) {
    return report.reviewMode;
  }
  return getScreenshotReviewMode(report.screenCount) ?? "single-screen";
}

/** sessionStorage·IndexedDB에 저장된 구형 리포트 필드를 정규화합니다. */
export function normalizeScreenshotReviewReport(
  report: ScreenshotReviewReport
): ScreenshotReviewReport {
  const screenLayoutMode = resolveReportScreenLayoutMode(report);
  const reviewMode = resolveReportReviewMode(report);

  return {
    ...report,
    reviewMode,
    screenLayoutMode,
  };
}

export function getReviewDepthLabel(mode: ReviewMode): string {
  return mode === "quick" ? "빠른 리뷰" : "정밀 리뷰";
}
