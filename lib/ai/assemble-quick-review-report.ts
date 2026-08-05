import type { CropMetadata, ProcessedScreenImage } from "@/lib/ai/image-preprocess";
import type { QuickReviewDraft } from "@/lib/ai/schemas/quick-review";
import type { ScreenshotReviewMetadata } from "@/lib/ai/screenshot-review-server";
import { assemblePipelineReport } from "@/lib/ai/assemble-pipeline-report";
import type { ScreenshotReviewQuality, ScreenshotReviewReport } from "@/lib/types";
import { PIPELINE_VERSION } from "@/lib/ai/config";

const PLACEHOLDER_QUALITY: ScreenshotReviewQuality = {
  specificity: 0,
  evidenceQuality: 0,
  actionability: 0,
  prioritization: 0,
  nonHallucination: 0,
  wasRewritten: false,
};

export function assembleQuickReviewReport(input: {
  metadata: ScreenshotReviewMetadata;
  draft: QuickReviewDraft;
  cropMetadata: CropMetadata[];
}): ScreenshotReviewReport {
  const report = assemblePipelineReport({
    metadata: input.metadata,
    draft: input.draft,
    quality: PLACEHOLDER_QUALITY,
    cropMetadata: input.cropMetadata,
  });

  return {
    ...report,
    pipelineVersion: PIPELINE_VERSION,
    reviewMode: "quick",
    quality: null,
  };
}

export type { ProcessedScreenImage };
