/**
 * URL 리뷰 캡처 미리보기 저장.
 * 업로드 리뷰는 사용자 File → objectURL(세션 내), URL 리뷰는 서버 WebP → IndexedDB.
 * 흐름·용량·새로고침 요구가 달라 UploadedScreen 타입만 공유하고 저장소는 분리합니다.
 */
import {
  getScreenAsset,
  saveScreenAsset,
  deleteScreenAssetsForReview,
} from "@/lib/screen-asset-store";
import {
  buildScreenAssetKey,
  UrlReviewAssetError,
  isUrlReviewReport,
} from "@/lib/url-review-report-utils";
import type {
  DeviceType,
  ReportScreenAssetRef,
  ScreenCropMetadata,
  ScreenshotReviewReport,
  UploadedScreen,
  UrlScreenAssetTransfer,
} from "@/lib/types";

const URL_REPORT_SESSION_PREFIX = "ux-ray:url-report:";

function devLog(event: string, payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "development") {
    console.info(event, payload);
  }
}

function reportSessionKey(reviewId: string): string {
  return `${URL_REPORT_SESSION_PREFIX}${reviewId}`;
}

export function saveUrlReportToSession(
  reviewId: string,
  report: ScreenshotReviewReport
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(reportSessionKey(reviewId), JSON.stringify(report));
}

export function loadUrlReportFromSession(
  reviewId: string
): ScreenshotReviewReport | null {
  if (typeof sessionStorage === "undefined") return null;

  const raw = sessionStorage.getItem(reportSessionKey(reviewId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ScreenshotReviewReport;
  } catch {
    return null;
  }
}

export function clearUrlReportSession(reviewId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(reportSessionKey(reviewId));
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export function createUrlUploadedScreen(input: {
  screenId: string;
  previewUrl: string;
  previewWidth: number;
  previewHeight: number;
  screenName: string;
  deviceType: DeviceType;
  order?: number;
}): UploadedScreen {
  return {
    id: input.screenId,
    file: new File([], "capture.webp", { type: "image/webp" }),
    fileName: input.screenName,
    previewUrl: input.previewUrl,
    width: input.previewWidth,
    height: input.previewHeight,
    fileSize: 0,
    order: input.order ?? 0,
    screenName: input.screenName,
    deviceType: input.deviceType,
  };
}

export function scaleCropMetadataForPreview(
  crop: ScreenCropMetadata,
  originalWidth: number,
  originalHeight: number,
  previewWidth: number,
  previewHeight: number
): ScreenCropMetadata {
  const scaleX = previewWidth / originalWidth;
  const scaleY = previewHeight / originalHeight;
  const yStart = Math.round(crop.yStart * scaleY);
  const yEnd = Math.round(crop.yEnd * scaleY);

  return {
    ...crop,
    yStart,
    yEnd,
    width: Math.round(crop.width * scaleX),
    height: yEnd - yStart,
  };
}

function findAssetRef(
  report: ScreenshotReviewReport,
  screenId: string
): ReportScreenAssetRef | undefined {
  return report.screenAssets?.find((asset) => asset.screenId === screenId);
}

async function verifyStoredScreenAsset(input: {
  assetKey: string;
  reviewId: string;
  screenId: string;
}): Promise<StoredScreenAssetVerification> {
  const stored = await getScreenAsset(input.assetKey);
  const found = stored != null;
  const verification = {
    assetKey: input.assetKey,
    found,
    blobSize: stored?.blob.size ?? 0,
    width: stored?.width ?? 0,
    height: stored?.height ?? 0,
  };

  devLog("[url-review:asset-write-verify]", verification);

  if (!found || !stored?.blob || stored.blob.size <= 0) {
    throw new UrlReviewAssetError(
      `캡처 미리보기 저장 검증에 실패했습니다. (assetKey: ${input.assetKey})`
    );
  }

  return verification;
}

interface StoredScreenAssetVerification {
  assetKey: string;
  found: boolean;
  blobSize: number;
  width: number;
  height: number;
}

async function persistTransferAsset(input: {
  reviewId: string;
  transfer: UrlScreenAssetTransfer;
  screenName: string;
  deviceType: DeviceType;
}): Promise<UploadedScreen> {
  const { reviewId, transfer, screenName, deviceType } = input;
  const assetKey = buildScreenAssetKey(reviewId, transfer.screenId);

  if (!transfer.preview.base64) {
    throw new UrlReviewAssetError(
      `전송된 preview base64가 비어 있습니다. (screenId: ${transfer.screenId})`
    );
  }

  const blob = base64ToBlob(transfer.preview.base64, transfer.preview.mimeType);

  await saveScreenAsset({
    key: assetKey,
    reviewId,
    screenId: transfer.screenId,
    blob,
    width: transfer.preview.width,
    height: transfer.preview.height,
    originalWidth: transfer.originalWidth,
    originalHeight: transfer.originalHeight,
    crops: transfer.crops,
    createdAt: new Date().toISOString(),
  });

  await verifyStoredScreenAsset({
    assetKey,
    reviewId,
    screenId: transfer.screenId,
  });

  transfer.preview.base64 = "";

  devLog("[url-review:preview-render]", {
    reviewId,
    screenId: transfer.screenId,
    hasObjectUrl: true,
    mimeType: transfer.preview.mimeType,
    blobSize: blob.size,
  });

  return createUrlUploadedScreen({
    screenId: transfer.screenId,
    previewUrl: URL.createObjectURL(blob),
    previewWidth: transfer.preview.width,
    previewHeight: transfer.preview.height,
    screenName,
    deviceType,
  });
}

async function loadScreenFromAssetRef(input: {
  routeReviewId: string;
  ref: ReportScreenAssetRef;
  screenName: string;
  deviceType: DeviceType;
}): Promise<UploadedScreen | null> {
  const { routeReviewId, ref, screenName, deviceType } = input;

  const stored = await getScreenAsset(ref.assetKey);

  devLog("[url-review:asset-read]", {
    routeReviewId,
    screenId: ref.screenId,
    assetKey: ref.assetKey,
    found: stored != null,
    blobSize: stored?.blob.size ?? 0,
  });

  if (!stored?.blob || stored.blob.size <= 0) {
    return null;
  }

  devLog("[url-review:preview-render]", {
    reviewId: routeReviewId,
    screenId: ref.screenId,
    hasObjectUrl: true,
    mimeType: stored.blob.type || "image/webp",
    blobSize: stored.blob.size,
  });

  return createUrlUploadedScreen({
    screenId: ref.screenId,
    previewUrl: URL.createObjectURL(stored.blob),
    previewWidth: ref.previewWidth,
    previewHeight: ref.previewHeight,
    screenName,
    deviceType,
  });
}

export async function ingestUrlReviewScreenAssets(input: {
  reviewId: string;
  report: ScreenshotReviewReport;
  transferAssets: UrlScreenAssetTransfer[];
}): Promise<{ report: ScreenshotReviewReport; screens: UploadedScreen[] }> {
  if (!isUrlReviewReport(input.report)) {
    throw new UrlReviewAssetError("URL 리뷰 report가 아닙니다.");
  }

  const deviceType = input.report.source?.deviceType ?? "desktop";
  const screenName =
    input.report.source?.pageTitle?.trim() ||
    input.report.projectName?.trim() ||
    "캡처 화면";

  const screens: UploadedScreen[] = [];

  if (input.transferAssets.length > 0) {
    for (const transfer of input.transferAssets) {
      screens.push(
        await persistTransferAsset({
          reviewId: input.reviewId,
          transfer,
          screenName,
          deviceType,
        })
      );
    }
  } else if (input.report.screenAssets?.length) {
    for (const ref of input.report.screenAssets) {
      const expectedKey = buildScreenAssetKey(input.reviewId, ref.screenId);
      if (ref.assetKey !== expectedKey) {
        devLog("[url-review:asset-key-mismatch]", {
          routeReviewId: input.reviewId,
          screenId: ref.screenId,
          assetKey: ref.assetKey,
          expectedKey,
        });
      }

      const screen = await loadScreenFromAssetRef({
        routeReviewId: input.reviewId,
        ref,
        screenName,
        deviceType,
      });
      if (screen) screens.push(screen);
    }
  }

  const report: ScreenshotReviewReport = {
    ...input.report,
    screenAssets:
      input.report.screenAssets?.map((ref) => ({
        ...ref,
        assetKey: buildScreenAssetKey(input.reviewId, ref.screenId),
      })) ?? [],
  };

  saveUrlReportToSession(input.reviewId, report);

  if (input.transferAssets.length > 0 && screens.length === 0) {
    throw new UrlReviewAssetError("screenAssets 전송 후 IndexedDB 저장 결과가 비어 있습니다.");
  }

  return { report, screens };
}

export async function loadUrlReviewScreensFromStorage(input: {
  reviewId: string;
  report: ScreenshotReviewReport;
}): Promise<UploadedScreen[]> {
  const result = await ingestUrlReviewScreenAssets({
    reviewId: input.reviewId,
    report: input.report,
    transferAssets: [],
  });
  return result.screens;
}

export function scaleEvidenceCropForUrlReport(
  crop: ScreenCropMetadata,
  report: ScreenshotReviewReport
): ScreenCropMetadata {
  const assetRef = findAssetRef(report, crop.screenId);
  if (!assetRef) return crop;

  return scaleCropMetadataForPreview(
    crop,
    assetRef.originalWidth,
    assetRef.originalHeight,
    assetRef.previewWidth,
    assetRef.previewHeight
  );
}

export async function clearUrlReviewClientData(
  reviewId: string,
  report?: ScreenshotReviewReport | null
): Promise<void> {
  const assetKeys = report?.screenAssets?.map((asset) => asset.assetKey) ?? [];
  await deleteScreenAssetsForReview(reviewId, assetKeys);
  clearUrlReportSession(reviewId);
}

export function revokeUploadedScreenUrls(screens: UploadedScreen[]): void {
  for (const screen of screens) {
    if (screen.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(screen.previewUrl);
    }
  }
}

export { isUrlReviewReport };
