import type { ReviewMode } from "@/lib/types";
import {
  LEGACY_PIPELINE_VERSION,
  PIPELINE_VERSION,
} from "@/lib/ai/config";
import type { ScreenshotReviewReport } from "@/lib/types";
import { resolveReportReviewMode } from "@/lib/review-mode-utils";

const SUPPORTED_PIPELINE_VERSIONS = new Set<string>([
  PIPELINE_VERSION,
  LEGACY_PIPELINE_VERSION,
]);

function hasValidQuality(report: ScreenshotReviewReport): boolean {
  const quality = report.quality;
  if (!quality) return false;

  return (
    typeof quality.specificity === "number" &&
    typeof quality.evidenceQuality === "number" &&
    typeof quality.actionability === "number" &&
    typeof quality.prioritization === "number" &&
    typeof quality.nonHallucination === "number" &&
    typeof quality.wasRewritten === "boolean"
  );
}

export function isCompletePipelineReport(report: unknown): report is ScreenshotReviewReport {
  if (!report || typeof report !== "object") return false;

  const value = report as ScreenshotReviewReport;

  if (value.analysisType !== "ai") return false;

  const version = value.pipelineVersion ?? LEGACY_PIPELINE_VERSION;
  if (!SUPPORTED_PIPELINE_VERSIONS.has(version)) return false;

  if (
    value.pageSummary == null ||
    typeof value.pageSummary.probablePurpose !== "string" ||
    typeof value.executiveSummary !== "string" ||
    value.executiveSummary.trim().length === 0 ||
    !Array.isArray(value.strengths) ||
    !Array.isArray(value.issues) ||
    !Array.isArray(value.limitations)
  ) {
    return false;
  }

  const reviewMode = resolveReportReviewMode(value);

  if (reviewMode === "quick") {
    return value.quality == null;
  }

  return hasValidQuality(value);
}

export function isSupportedPipelineVersion(version: string | undefined): boolean {
  if (!version) return false;
  return SUPPORTED_PIPELINE_VERSIONS.has(version);
}

export function pipelineVersionForReviewMode(mode: ReviewMode): string {
  return PIPELINE_VERSION;
}
