import sharp from "sharp";
import type { PipelineStageTracker } from "@/lib/ai/pipeline/pipeline-stage";
import { setPipelineStage } from "@/lib/ai/pipeline/pipeline-stage";

export interface CropMetadata {
  cropId: string;
  screenId: string;
  index: number;
  yStart: number;
  yEnd: number;
  locationLabel: string;
  width: number;
  height: number;
}

export interface ProcessedCrop {
  metadata: CropMetadata;
  buffer: Buffer;
}

export interface ProcessedScreenImage {
  screenId: string;
  mimeType: string;
  width: number;
  height: number;
  sha256Prefix: string;
  analysisBuffer: Buffer;
  analysisMimeType: string;
  analysisWidth: number;
  analysisHeight: number;
  overviewBuffer: Buffer;
  overviewWidth: number;
  overviewHeight: number;
  crops: ProcessedCrop[];
}

const MAX_CROPS_PER_SCREEN = 8;
/** 매우 긴 화면(세로 TALL_IMAGE_HEIGHT_PX 이상)은 Observer에게 보내는 crop 수를 더 낮게 제한합니다. */
const MAX_CROPS_PER_TALL_SCREEN = 5;
const TALL_IMAGE_HEIGHT_PX = 8_000;
const OVERLAP_RATIO = 0.12;
const MIN_SPLIT_HEIGHT_RATIO = 2.2;
const MIN_SPLIT_HEIGHT_PX = 1600;
const ANALYSIS_MAX_WIDTH = 1600;
const OVERVIEW_MAX_WIDTH = ANALYSIS_MAX_WIDTH;

export class ImagePreprocessValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagePreprocessValidationError";
  }
}

export interface ExtractRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function validateExtractCoordinates(
  region: ExtractRegion,
  sourceWidth: number,
  sourceHeight: number
): void {
  if (!Number.isInteger(region.left) || region.left < 0) {
    throw new ImagePreprocessValidationError("extract.left must be an integer >= 0");
  }

  if (!Number.isInteger(region.top) || region.top < 0) {
    throw new ImagePreprocessValidationError("extract.top must be an integer >= 0");
  }

  if (!Number.isInteger(region.width) || region.width < 1) {
    throw new ImagePreprocessValidationError("extract.width must be an integer >= 1");
  }

  if (!Number.isInteger(region.height) || region.height < 1) {
    throw new ImagePreprocessValidationError("extract.height must be an integer >= 1");
  }

  if (region.left + region.width > sourceWidth) {
    throw new ImagePreprocessValidationError("extract.width exceeds image bounds");
  }

  if (region.top + region.height > sourceHeight) {
    throw new ImagePreprocessValidationError("extract.height exceeds image bounds");
  }
}

export function normalizeExtractRegion(
  raw: ExtractRegion,
  sourceWidth: number,
  sourceHeight: number
): ExtractRegion {
  const left = Math.max(0, Math.floor(raw.left));
  const top = Math.max(0, Math.floor(raw.top));

  const width = Math.max(1, Math.min(sourceWidth - left, Math.floor(raw.width)));

  const height = Math.max(1, Math.min(sourceHeight - top, Math.floor(raw.height)));

  return { left, top, width, height };
}

function logCropExtract(input: {
  cropId: string;
  sourceWidth: number;
  sourceHeight: number;
  left: number;
  top: number;
  width: number;
  height: number;
}): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[screenshot-review:crop]", {
    cropId: input.cropId,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    left: input.left,
    top: input.top,
    width: input.width,
    height: input.height,
  });
}

function assertSharpAvailable(): void {
  if (typeof sharp !== "function") {
    throw new ImagePreprocessValidationError("sharp import is not available");
  }
}

function assertNonEmptyBuffer(buffer: Buffer): void {
  if (!buffer || buffer.byteLength === 0) {
    throw new ImagePreprocessValidationError("image buffer is empty");
  }
}

async function readSharpMetadata(buffer: Buffer): Promise<{ width: number; height: number }> {
  assertSharpAvailable();
  const metadata = await sharp(buffer).metadata();

  if (
    typeof metadata.width !== "number" ||
    typeof metadata.height !== "number" ||
    metadata.width < 1 ||
    metadata.height < 1
  ) {
    throw new ImagePreprocessValidationError("sharp metadata missing valid width or height");
  }

  return { width: metadata.width, height: metadata.height };
}

async function validatePreprocessInput(input: {
  buffer: Buffer;
  width: number;
  height: number;
}): Promise<{ width: number; height: number }> {
  assertNonEmptyBuffer(input.buffer);
  const metadata = await readSharpMetadata(input.buffer);
  return metadata;
}

function shouldSplitImage(width: number, height: number): boolean {
  return height / width >= MIN_SPLIT_HEIGHT_RATIO || height >= MIN_SPLIT_HEIGHT_PX;
}

function locationLabelForIndex(index: number, total: number): string {
  if (total <= 1) return "전체";
  if (total === 2) return index === 0 ? "상단" : "하단";
  if (total === 3) return ["상단", "중앙", "하단"][index] ?? "중앙";
  if (total === 4) {
    return ["상단", "상단 중간", "하단 중간", "하단"][index] ?? "중앙";
  }

  const fraction = index / (total - 1);
  if (fraction <= 0.125) return "상단";
  if (fraction <= 0.375) return "상단 중간";
  if (fraction <= 0.625) return "중앙";
  if (fraction <= 0.875) return "하단 중간";
  return "하단";
}

function computeCropRegions(
  width: number,
  height: number
): Array<{ yStart: number; yEnd: number }> {
  const targetCropHeight = Math.max(width, 900);
  let numCrops = Math.ceil(height / (targetCropHeight * (1 - OVERLAP_RATIO)));
  const cropCap = height >= TALL_IMAGE_HEIGHT_PX ? MAX_CROPS_PER_TALL_SCREEN : MAX_CROPS_PER_SCREEN;
  numCrops = Math.min(cropCap, Math.max(2, numCrops));

  const cropHeight = Math.ceil(height / (numCrops - (numCrops - 1) * OVERLAP_RATIO));
  const step = cropHeight * (1 - OVERLAP_RATIO);

  const regions: Array<{ yStart: number; yEnd: number }> = [];
  for (let i = 0; i < numCrops; i += 1) {
    const yStart = Math.floor(i * step);
    const yEnd = i === numCrops - 1 ? height : Math.min(height, Math.floor(yStart + cropHeight));
    if (yEnd <= yStart) continue;
    regions.push({ yStart, yEnd });
  }

  return regions;
}

async function buildAnalysisBuffer(buffer: Buffer): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: string;
}> {
  assertSharpAvailable();
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new ImagePreprocessValidationError("sharp metadata missing valid width or height");
  }

  if (width <= ANALYSIS_MAX_WIDTH) {
    return { buffer, width, height, mimeType: "image/png" };
  }

  const normalized = await sharp(buffer)
    .resize({ width: ANALYSIS_MAX_WIDTH, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: normalized.data,
    width: normalized.info.width,
    height: normalized.info.height,
    mimeType: "image/jpeg",
  };
}

async function buildOverview(buffer: Buffer): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
}> {
  const overview = await sharp(buffer)
    .resize({ width: OVERVIEW_MAX_WIDTH, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: overview.data,
    width: overview.info.width,
    height: overview.info.height,
  };
}

async function buildCrops(
  analysisBuffer: Buffer,
  screenId: string,
  originalWidth: number,
  originalHeight: number,
  analysisWidth: number,
  analysisHeight: number
): Promise<ProcessedCrop[]> {
  const regions = computeCropRegions(originalWidth, originalHeight);
  const crops: ProcessedCrop[] = [];
  const yScale = analysisHeight / originalHeight;

  for (let index = 0; index < regions.length; index += 1) {
    const region = regions[index]!;
    const cropId = `${screenId}-crop-${index + 1}`;
    const originalTop = Math.floor(region.yStart);
    const originalRequestedHeight = Math.floor(region.yEnd - region.yStart);
    const originalHeightClamped = Math.min(originalRequestedHeight, originalHeight - originalTop);

    const analysisTop = Math.floor(originalTop * yScale);
    const analysisHeightClamped = Math.max(
      1,
      Math.min(Math.floor(originalHeightClamped * yScale), analysisHeight - analysisTop)
    );

    const extractRegion = normalizeExtractRegion(
      {
        left: 0,
        top: analysisTop,
        width: analysisWidth,
        height: analysisHeightClamped,
      },
      analysisWidth,
      analysisHeight
    );

    validateExtractCoordinates(extractRegion, analysisWidth, analysisHeight);

    logCropExtract({
      cropId,
      sourceWidth: analysisWidth,
      sourceHeight: analysisHeight,
      left: extractRegion.left,
      top: extractRegion.top,
      width: extractRegion.width,
      height: extractRegion.height,
    });

    const cropBuffer = await sharp(analysisBuffer)
      .extract(extractRegion)
      .jpeg({ quality: 85 })
      .toBuffer();

    const metadata: CropMetadata = {
      cropId,
      screenId,
      index,
      yStart: originalTop,
      yEnd: originalTop + originalHeightClamped,
      locationLabel: locationLabelForIndex(index, regions.length),
      width: originalWidth,
      height: originalHeightClamped,
    };

    crops.push({ metadata, buffer: cropBuffer });
  }

  return crops;
}

export async function preprocessScreenshotImage(
  input: {
    screenId: string;
    buffer: Buffer;
    mimeType: string;
    width: number;
    height: number;
    sha256Prefix: string;
  },
  stageTracker?: PipelineStageTracker
): Promise<ProcessedScreenImage> {
  if (stageTracker) {
    setPipelineStage(stageTracker, "image-preprocessing");
  }

  await validatePreprocessInput({
    buffer: input.buffer,
    width: input.width,
    height: input.height,
  });

  const analysis = await buildAnalysisBuffer(input.buffer);
  const overview = await buildOverview(analysis.buffer);
  const split = shouldSplitImage(input.width, input.height);

  if (stageTracker && split) {
    setPipelineStage(stageTracker, "image-cropping");
  }

  const crops = split
    ? await buildCrops(
        analysis.buffer,
        input.screenId,
        input.width,
        input.height,
        analysis.width,
        analysis.height
      )
    : [];

  return {
    screenId: input.screenId,
    mimeType: input.mimeType,
    width: input.width,
    height: input.height,
    sha256Prefix: input.sha256Prefix,
    analysisBuffer: analysis.buffer,
    analysisMimeType: analysis.mimeType,
    analysisWidth: analysis.width,
    analysisHeight: analysis.height,
    overviewBuffer: overview.buffer,
    overviewWidth: overview.width,
    overviewHeight: overview.height,
    crops,
  };
}

export function collectCropMetadata(screens: ProcessedScreenImage[]): CropMetadata[] {
  return screens.flatMap((screen) => screen.crops.map((crop) => crop.metadata));
}
