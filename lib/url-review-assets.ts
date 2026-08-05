/**
 * URL 리뷰 캡처 미리보기 저장.
 * 업로드 리뷰는 사용자가 고른 File → objectURL을 그대로 쓰고(세션 내 유지),
 * URL 리뷰는 서버 생성 WebP를 IndexedDB에 둡니다 — 업로드 흐름·용량·새로고침
 * 요구가 달라 이번 단계에서는 UploadedScreen 타입만 공유하고 저장소는 분리합니다.
 */
import {
  deleteScreenAssetsForReview,
  getScreenAsset,
  saveScreenAsset,
} from "@/lib/screen-asset-store";
import type {
  DeviceType,
  ReportScreenAssetRef,
  ScreenCropMetadata,
  ScreenshotReviewReport,
  UploadedScreen,
  UrlScreenAssetTransfer,
} from "@/lib/types";

const URL_REPORT_SESSION_PREFIX = "ux-ray:url-report:";

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

async function persistTransferAsset(
  reviewId: string,
  transfer: UrlScreenAssetTransfer,
  screenName: string,
  deviceType: DeviceType
): Promise<UploadedScreen> {
  const assetKey = `${reviewId}:${transfer.screenId}`;
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

  transfer.preview.base64 = "";

  return createUrlUploadedScreen({
    screenId: transfer.screenId,
    previewUrl: URL.createObjectURL(blob),
    previewWidth: transfer.preview.width,
    previewHeight: transfer.preview.height,
    screenName,
    deviceType,
  });
}

async function loadScreenFromAssetRef(
  reviewId: string,
  ref: ReportScreenAssetRef,
  screenName: string,
  deviceType: DeviceType
): Promise<UploadedScreen | null> {
  const stored = await getScreenAsset(ref.assetKey);
  if (!stored) return null;

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
  const deviceType = input.report.source?.deviceType ?? "desktop";
  const screenName =
    input.report.source?.pageTitle?.trim() ||
    input.report.projectName?.trim() ||
    "캡처 화면";

  const screens: UploadedScreen[] = [];

  if (input.transferAssets.length > 0) {
    for (const transfer of input.transferAssets) {
      screens.push(
        await persistTransferAsset(
          input.reviewId,
          transfer,
          screenName,
          deviceType
        )
      );
    }
  } else if (input.report.screenAssets?.length) {
    for (const ref of input.report.screenAssets) {
      const screen = await loadScreenFromAssetRef(
        input.reviewId,
        ref,
        screenName,
        deviceType
      );
      if (screen) screens.push(screen);
    }
  }

  const report: ScreenshotReviewReport = {
    ...input.report,
    screenAssets: input.report.screenAssets ?? [],
  };

  saveUrlReportToSession(input.reviewId, report);

  if (process.env.NODE_ENV === "development") {
    console.info("[url-review:client-assets]", {
      reviewId: input.reviewId,
      screenAssetCount: report.screenAssets?.length ?? 0,
      loadedScreenCount: screens.length,
      reportHasBase64: JSON.stringify(report).includes('"base64"'),
    });
  }

  return { report, screens };
}

export async function loadUrlReviewScreensFromStorage(input: {
  reviewId: string;
  report: ScreenshotReviewReport;
}): Promise<UploadedScreen[]> {
  const deviceType = input.report.source?.deviceType ?? "desktop";
  const screenName =
    input.report.source?.pageTitle?.trim() ||
    input.report.projectName?.trim() ||
    "캡처 화면";
  const refs = input.report.screenAssets ?? [];
  const screens: UploadedScreen[] = [];

  for (const ref of refs) {
    const screen = await loadScreenFromAssetRef(
      input.reviewId,
      ref,
      screenName,
      deviceType
    );
    if (screen) screens.push(screen);
  }

  return screens;
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
