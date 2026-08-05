import type { CropMetadata } from "@/lib/ai/image-preprocess";
import { generateCapturePreviewWebp } from "@/lib/capture/capture-preview";
import type { CapturedUrlPage } from "@/lib/capture/url-types";
import { buildScreenAssetKey } from "@/lib/url-review-report-utils";
import type {
  ReportScreenAssetRef,
  ScreenAssetCrop,
  ScreenshotReviewReport,
  UrlScreenAssetTransfer,
} from "@/lib/types";

export function cropMetadataToAssetCrops(crops: CropMetadata[]): ScreenAssetCrop[] {
  return crops.map((crop) => ({
    cropId: crop.cropId,
    left: 0,
    top: crop.yStart,
    width: crop.width,
    height: crop.yEnd - crop.yStart,
  }));
}

export function buildReportScreenAssetRefs(input: {
  reviewId: string;
  screenId: string;
  originalWidth: number;
  originalHeight: number;
  previewWidth: number;
  previewHeight: number;
  crops: ScreenAssetCrop[];
}): ReportScreenAssetRef[] {
  return [
    {
      screenId: input.screenId,
      assetKey: buildScreenAssetKey(input.reviewId, input.screenId),
      originalWidth: input.originalWidth,
      originalHeight: input.originalHeight,
      previewWidth: input.previewWidth,
      previewHeight: input.previewHeight,
      crops: input.crops,
    },
  ];
}

export async function buildUrlScreenAssetsTransfer(input: {
  reviewId: string;
  screenId: string;
  captured: CapturedUrlPage;
  cropMetadata: ScreenshotReviewReport["cropMetadata"];
}): Promise<{
  transfer: UrlScreenAssetTransfer[];
  refs: ReportScreenAssetRef[];
  previewByteSize: number;
}> {
  const preview = await generateCapturePreviewWebp(input.captured.fullPageImage);
  const crops = cropMetadataToAssetCrops(
    (input.cropMetadata ?? []).filter((crop) => crop.screenId === input.screenId)
  );

  const transfer: UrlScreenAssetTransfer = {
    screenId: input.screenId,
    sourceType: "url",
    preview: {
      mimeType: preview.mimeType,
      width: preview.width,
      height: preview.height,
      base64: preview.base64,
    },
    originalWidth: input.captured.width,
    originalHeight: input.captured.height,
    crops,
  };

  const refs = buildReportScreenAssetRefs({
    reviewId: input.reviewId,
    screenId: input.screenId,
    originalWidth: input.captured.width,
    originalHeight: input.captured.height,
    previewWidth: preview.width,
    previewHeight: preview.height,
    crops,
  });

  preview.buffer.fill(0);

  return {
    transfer: [transfer],
    refs,
    previewByteSize: preview.byteSize,
  };
}
