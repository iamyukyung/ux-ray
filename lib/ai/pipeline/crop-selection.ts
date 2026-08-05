import type { ProcessedCrop, ProcessedScreenImage } from "@/lib/ai/image-preprocess";
import type { ScreenshotReviewDraft } from "@/lib/ai/schemas/screenshot-review-draft";
import { collectReferencedCropIds } from "@/lib/ai/postprocess-pipeline-draft";
import type { UrlDomSnapshot } from "@/lib/capture/url-types";

export const REVIEWER_MAX_CROPS = 4;
export const CRITIC_MAX_CROPS = 3;
export const QUICK_MAX_CROPS_SINGLE_LONG = 3;
export const QUICK_MAX_CROPS_SINGLE_SHORT = 1;
export const QUICK_MAX_IMAGES_MULTI = 6;
export const QUICK_MAX_IMAGES_SINGLE_LONG = 4;

export interface QuickReviewImagePart {
  screenId: string;
  cropId: string;
  label: string;
  buffer: Buffer;
  mimeType: string;
  detail: "low" | "high";
}

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

function cropVerticalCenter(crop: ProcessedCrop): number {
  return (crop.metadata.yStart + crop.metadata.yEnd) / 2;
}

function scoreCropForUrlDom(crop: ProcessedCrop, domSnapshot?: UrlDomSnapshot): number {
  if (!domSnapshot) return 0;
  const centerY = cropVerticalCenter(crop);
  let score = 0;

  for (const heading of domSnapshot.headings) {
    if (Math.abs(heading.top - centerY) < 400) score += heading.level === 1 ? 6 : 3;
  }
  for (const form of domSnapshot.forms) {
    if (Math.abs(form.top - centerY) < 500) score += 8;
  }
  for (const element of domSnapshot.interactiveElements) {
    if (Math.abs(element.top - centerY) < 350) score += 4;
  }

  const pageHeight = Math.max(
    ...domSnapshot.headings.map((item) => item.top),
    ...domSnapshot.forms.map((item) => item.top),
    1
  );
  const relativeTop = centerY / pageHeight;
  if (relativeTop <= 0.2) score += 2;
  if (relativeTop >= 0.75) score += 3;
  if (relativeTop >= 0.4 && relativeTop <= 0.65) score += 2;

  return score;
}

function dedupeOverlappingCrops(crops: ProcessedCrop[]): ProcessedCrop[] {
  const kept: ProcessedCrop[] = [];
  for (const crop of crops) {
    const overlaps = kept.some((existing) => {
      const overlapStart = Math.max(existing.metadata.yStart, crop.metadata.yStart);
      const overlapEnd = Math.min(existing.metadata.yEnd, crop.metadata.yEnd);
      const overlap = overlapEnd - overlapStart;
      const minHeight = Math.min(
        existing.metadata.yEnd - existing.metadata.yStart,
        crop.metadata.yEnd - crop.metadata.yStart
      );
      return overlap > 0 && overlap / Math.max(minHeight, 1) > 0.55;
    });
    if (!overlaps) kept.push(crop);
  }
  return kept;
}

export function selectQuickReviewCropsForScreen(
  screen: ProcessedScreenImage,
  maxCount: number,
  domSnapshot?: UrlDomSnapshot
): ProcessedCrop[] {
  if (screen.crops.length === 0 || maxCount <= 0) return [];

  if (domSnapshot) {
    const ranked = [...screen.crops].sort(
      (a, b) => scoreCropForUrlDom(b, domSnapshot) - scoreCropForUrlDom(a, domSnapshot)
    );
    return dedupeOverlappingCrops(ranked).slice(0, maxCount);
  }

  return selectEvenlyLimitedCrops(screen.crops, maxCount);
}

export function selectQuickReviewImages(
  processedScreens: ProcessedScreenImage[],
  options?: { domSnapshot?: UrlDomSnapshot }
): QuickReviewImagePart[] {
  const sorted = [...processedScreens].sort((a, b) => a.screenId.localeCompare(b.screenId));
  const parts: QuickReviewImagePart[] = [];

  if (sorted.length > 1) {
    for (const screen of sorted) {
      if (parts.length >= QUICK_MAX_IMAGES_MULTI) break;
      parts.push({
        screenId: screen.screenId,
        cropId: `${screen.screenId}-overview`,
        label: `[Overview] ${screen.screenId}`,
        buffer: screen.overviewBuffer,
        mimeType: "image/jpeg",
        detail: "low",
      });
    }
    return parts;
  }

  const screen = sorted[0];
  if (!screen) return parts;

  const isLongScreen = screen.crops.length > 0;
  parts.push({
    screenId: screen.screenId,
    cropId: `${screen.screenId}-overview`,
    label: `[Overview] ${screen.screenId}`,
    buffer: isLongScreen ? screen.overviewBuffer : screen.analysisBuffer,
    mimeType: isLongScreen ? "image/jpeg" : screen.analysisMimeType,
    detail: "low",
  });

  const maxCrops = isLongScreen
    ? QUICK_MAX_CROPS_SINGLE_LONG
    : QUICK_MAX_CROPS_SINGLE_SHORT;
  const selectedCrops = selectQuickReviewCropsForScreen(
    screen,
    maxCrops,
    options?.domSnapshot
  );

  for (const crop of selectedCrops) {
    if (parts.length >= QUICK_MAX_IMAGES_SINGLE_LONG) break;
    parts.push({
      screenId: screen.screenId,
      cropId: crop.metadata.cropId,
      label: `[Crop ${crop.metadata.cropId}] ${crop.metadata.locationLabel}`,
      buffer: crop.buffer,
      mimeType: "image/jpeg",
      detail: "high",
    });
  }

  return parts;
}
