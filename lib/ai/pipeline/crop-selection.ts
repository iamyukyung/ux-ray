import type { ProcessedCrop, ProcessedScreenImage } from "@/lib/ai/image-preprocess";
import type { ScreenshotReviewDraft } from "@/lib/ai/schemas/screenshot-review-draft";
import { collectReferencedCropIds } from "@/lib/ai/postprocess-pipeline-draft";

export const REVIEWER_MAX_CROPS = 4;
export const CRITIC_MAX_CROPS = 3;

function selectEvenlyLimitedCrops(crops: ProcessedCrop[], maxCount: number): ProcessedCrop[] {
  if (crops.length <= maxCount) return crops;
  if (maxCount <= 0) return [];
  if (maxCount === 1) return [crops[0]!];

  const selected: ProcessedCrop[] = [];
  for (let index = 0; index < maxCount; index += 1) {
    const cropIndex = Math.round((index * (crops.length - 1)) / (maxCount - 1));
    selected.push(crops[cropIndex]!);
  }

  return selected;
}

export function buildValidCropIdSet(processedScreens: ProcessedScreenImage[]): Set<string> {
  const cropIds = new Set<string>();
  for (const screen of processedScreens) {
    cropIds.add(`${screen.screenId}-overview`);
    for (const crop of screen.crops) {
      cropIds.add(crop.metadata.cropId);
    }
  }
  return cropIds;
}

export function selectReviewerCrops(
  processedScreens: ProcessedScreenImage[],
  options: {
    validCropIds: Set<string>;
    draft?: ScreenshotReviewDraft;
  }
): ProcessedCrop[] {
  const allCrops = processedScreens.flatMap((screen) => screen.crops);

  if (options.draft) {
    const referenced = collectReferencedCropIds(options.draft);
    const matched = allCrops.filter((crop) =>
      referenced.has(crop.metadata.cropId) && options.validCropIds.has(crop.metadata.cropId)
    );
    return matched.slice(0, REVIEWER_MAX_CROPS);
  }

  return selectEvenlyLimitedCrops(allCrops, REVIEWER_MAX_CROPS);
}

export function selectCriticCrops(
  processedScreens: ProcessedScreenImage[],
  draft: ScreenshotReviewDraft,
  validCropIds: Set<string>
): ProcessedCrop[] {
  const referenced = collectReferencedCropIds(draft);
  const matched = processedScreens.flatMap((screen) =>
    screen.crops.filter(
      (crop) =>
        referenced.has(crop.metadata.cropId) && validCropIds.has(crop.metadata.cropId)
    )
  );

  return matched.slice(0, CRITIC_MAX_CROPS);
}

export function clearProcessedScreenBuffers(processedScreens: ProcessedScreenImage[]): void {
  for (const screen of processedScreens) {
    screen.analysisBuffer = Buffer.alloc(0);
    screen.overviewBuffer = Buffer.alloc(0);
    for (const crop of screen.crops) {
      crop.buffer = Buffer.alloc(0);
    }
  }
}

export function reviewerCropIdSet(crops: ProcessedCrop[]): Set<string> {
  return new Set(crops.map((crop) => crop.metadata.cropId));
}
