import type { ScreenshotReviewReport } from "@/lib/types";
import { PIPELINE_VERSION } from "@/lib/ai/config";

export function isCompletePipelineReport(report: unknown): report is ScreenshotReviewReport {
  if (!report || typeof report !== "object") return false;

  const value = report as ScreenshotReviewReport;

  return (
    value.analysisType === "ai" &&
    value.pipelineVersion === PIPELINE_VERSION &&
    value.pageSummary != null &&
    typeof value.pageSummary.probablePurpose === "string" &&
    typeof value.executiveSummary === "string" &&
    value.executiveSummary.trim().length > 0 &&
    Array.isArray(value.strengths) &&
    Array.isArray(value.issues) &&
    Array.isArray(value.limitations) &&
    value.quality != null &&
    typeof value.quality.specificity === "number" &&
    typeof value.quality.evidenceQuality === "number" &&
    typeof value.quality.actionability === "number" &&
    typeof value.quality.prioritization === "number" &&
    typeof value.quality.nonHallucination === "number" &&
    typeof value.quality.wasRewritten === "boolean"
  );
}
