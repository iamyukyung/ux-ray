export interface StickyOverlayRecord {
  stableId: string;
  stateKey: string;
  position: "fixed" | "sticky";
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  firstSeenScrollY: number;
  repeatCount: number;
}

export interface PageCaptureData {
  headings: string[];
  buttons: string[];
  links: string[];
  documentWidth: number;
  documentHeight: number;
  hasHorizontalOverflow: boolean;
  /** fixed/sticky overlay 분석 — AI·DOM 분석용 (캡처 시 숨김과 무관하게 수집) */
  stickyOverlays?: StickyOverlayRecord[];
}

export type CaptureStatus = "full" | "partial";

export interface CaptureSegment {
  scrollY: number;
  screenshot: string;
}

export interface CapturedScreenshot {
  imageDataUrl: string;
  requestedUrl: string;
  finalUrl: string;
  userAgent: string;
  viewportWidth: number;
  viewportHeight: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  imagePixelWidth: number;
  imagePixelHeight: number;
  capturedAt: string;
  captureStatus: CaptureStatus;
  captureWarning?: string;
  documentHeight: number;
  capturedHeight: number;
  firstViewportScreenshot: string;
  segments?: CaptureSegment[];
  stickyOverlays?: StickyOverlayRecord[];
}

export interface CaptureResult {
  normalizedUrl: string;
  title: string;
  desktopScreenshot: CapturedScreenshot;
  mobileScreenshot: CapturedScreenshot;
  pageData: PageCaptureData;
}

export type CaptureProgressStep =
  | "connect"
  | "desktop-screenshot"
  | "mobile-screenshot"
  | "structure"
  | "demo-report";

export type CaptureErrorCode =
  | "BLOCKED_URL"
  | "UNREACHABLE"
  | "TIMEOUT"
  | "SSL_ERROR"
  | "CAPTURE_FAILED"
  | "SLOW_LOADING"
  | "INVALID_URL";

export interface CaptureErrorResponse {
  error: CaptureErrorCode;
  message: string;
}

export interface CaptureProgressEvent {
  type: "progress";
  step: CaptureProgressStep;
}

export interface CaptureCompleteEvent extends CaptureResult {
  type: "result";
}

export type CaptureStreamEvent = CaptureProgressEvent | CaptureCompleteEvent;

function defaultDocumentHeights(device: "desktop" | "mobile") {
  return device === "desktop"
    ? { documentHeight: 900, capturedHeight: 900 }
    : { documentHeight: 844, capturedHeight: 844 };
}

/** 레거시 string 스크린샷 또는 불완전한 메타데이터 fallback */
export function resolveCapturedScreenshot(
  screenshot: CapturedScreenshot | string | undefined,
  device: "desktop" | "mobile",
  fallbackUrl = ""
): CapturedScreenshot | null {
  if (!screenshot) return null;

  const defaults = defaultDocumentHeights(device);

  if (typeof screenshot !== "string") {
    const imageDataUrl = screenshot.imageDataUrl;
    const firstViewport =
      screenshot.firstViewportScreenshot ?? imageDataUrl;

    return {
      ...screenshot,
      imageDataUrl,
      firstViewportScreenshot: firstViewport,
      requestedUrl: screenshot.requestedUrl ?? fallbackUrl,
      finalUrl: screenshot.finalUrl ?? fallbackUrl,
      userAgent: screenshot.userAgent ?? "",
      viewportWidth: screenshot.viewportWidth ?? (device === "desktop" ? 1440 : 390),
      viewportHeight: screenshot.viewportHeight ?? (device === "desktop" ? 900 : 844),
      deviceScaleFactor: screenshot.deviceScaleFactor ?? (device === "mobile" ? 3 : 1),
      isMobile: screenshot.isMobile ?? device === "mobile",
      hasTouch: screenshot.hasTouch ?? device === "mobile",
      imagePixelWidth: screenshot.imagePixelWidth ?? screenshot.viewportWidth,
      imagePixelHeight: screenshot.imagePixelHeight ?? screenshot.viewportHeight,
      capturedAt: screenshot.capturedAt ?? new Date().toISOString(),
      captureStatus: screenshot.captureStatus ?? "full",
      documentHeight: screenshot.documentHeight ?? defaults.documentHeight,
      capturedHeight: screenshot.capturedHeight ?? defaults.capturedHeight,
      segments: screenshot.segments,
      stickyOverlays: screenshot.stickyOverlays,
    };
  }

  const viewportWidth = device === "desktop" ? 1440 : 390;
  const viewportHeight = device === "desktop" ? 900 : 844;
  const deviceScaleFactor = device === "mobile" ? 3 : 1;

  return {
    imageDataUrl: screenshot,
    firstViewportScreenshot: screenshot,
    requestedUrl: fallbackUrl,
    finalUrl: fallbackUrl,
    userAgent: "",
    viewportWidth,
    viewportHeight,
    deviceScaleFactor,
    isMobile: device === "mobile",
    hasTouch: device === "mobile",
    imagePixelWidth: viewportWidth * deviceScaleFactor,
    imagePixelHeight: viewportHeight * deviceScaleFactor,
    capturedAt: new Date().toISOString(),
    captureStatus: "full",
    documentHeight: viewportHeight,
    capturedHeight: viewportHeight,
  };
}

/** Device Frame 미리보기용 — partial이면 첫 화면(fold) 우선 */
export function screenshotForPreview(shot: CapturedScreenshot): CapturedScreenshot {
  if (shot.captureStatus === "partial") {
    return { ...shot, imageDataUrl: shot.firstViewportScreenshot };
  }
  return shot;
}

export function isPartialCapture(capture: CaptureResult): boolean {
  return (
    capture.desktopScreenshot.captureStatus === "partial" ||
    capture.mobileScreenshot.captureStatus === "partial"
  );
}

export function getScreenshotImageUrl(
  screenshot: CapturedScreenshot | string | undefined
): string | undefined {
  if (!screenshot) return undefined;
  return typeof screenshot === "string" ? screenshot : screenshot.imageDataUrl;
}
