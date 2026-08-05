import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";
import {
  MAX_CAPTURE_HEIGHT,
  MAX_FULL_PAGE_HEIGHT,
  PARTIAL_CAPTURE_WARNING,
} from "./capture-constants";
import { CaptureError, mapPlaywrightError } from "./capture-errors";
import type {
  CaptureProgressStep,
  CaptureResult,
  CaptureSegment,
  CapturedScreenshot,
  CaptureStatus,
  PageCaptureData,
  StickyOverlayRecord,
} from "./capture-types";
import { getPngDimensions } from "./png-dimensions";
import { disableAnimations, preparePageForFullScreenshot } from "./prepare-page-screenshot";
import {
  collectAndTagVisibleOverlays,
  hideOverlayKeys,
  OverlayTracker,
  restoreOverlayVisibility,
} from "./sticky-overlay-capture";
import { assertSafeCaptureUrl, normalizeCaptureUrl } from "./url-security";

import {
  CAPTURE_DESKTOP_VIEWPORT,
  CAPTURE_LOAD_STATE_TIMEOUT_MS,
  CAPTURE_LOCALE,
  CAPTURE_NAVIGATION_TIMEOUT_MS,
  CAPTURE_STABILIZE_WAIT_MS,
  CAPTURE_TIMEZONE,
} from "@/lib/capture/capture-config";

const VIEWPORT_SETTLE_MS = 300;
const SEGMENT_SETTLE_MS = 200;

type ProgressCallback = (step: CaptureProgressStep) => void;

interface ContextCaptureMeta {
  requestedUrl: string;
  viewportWidth: number;
  viewportHeight: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}

interface BuildScreenshotParams {
  buffer: Buffer;
  meta: ContextCaptureMeta;
  finalUrl: string;
  userAgent: string;
  captureStatus: CaptureStatus;
  documentHeight: number;
  capturedHeight: number;
  firstViewportScreenshot: string;
  captureWarning?: string;
  segments?: CaptureSegment[];
  stickyOverlays?: StickyOverlayRecord[];
}

function isCaptureErrorLike(error: unknown): error is CaptureError {
  return (
    error instanceof CaptureError ||
    (typeof error === "object" &&
      error !== null &&
      (error as CaptureError).name === "CaptureError" &&
      typeof (error as CaptureError).code === "string")
  );
}

function bufferToDataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function assertMobileUserAgent(userAgent: string): void {
  if (!/Mobile|iPhone|Android/i.test(userAgent)) {
    throw new CaptureError(
      "CAPTURE_FAILED",
      "모바일 User-Agent가 올바르게 적용되지 않았어요. iPhone 13 device preset을 확인해주세요.",
      500
    );
  }
}

async function readUserAgent(page: Page): Promise<string> {
  return page.evaluate(() => navigator.userAgent);
}

async function extractPageData(page: Page): Promise<PageCaptureData> {
  return page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
      .map((element) => (element.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((text) => text.length > 0)
      .slice(0, 20);

    const buttons = Array.from(
      document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']")
    )
      .map((element) => (element.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((text) => text.length > 0)
      .slice(0, 30);

    const links = Array.from(document.querySelectorAll("a[href]"))
      .map((element) => (element.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((text) => text.length > 0)
      .slice(0, 30);

    const documentWidth = document.documentElement.scrollWidth;
    const documentHeight = document.documentElement.scrollHeight;

    return {
      headings,
      buttons,
      links,
      documentWidth,
      documentHeight,
      hasHorizontalOverflow: documentWidth > window.innerWidth + 1,
    };
  });
}

async function navigateSafely(page: Page, url: string): Promise<string> {
  const startedAt = Date.now();

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: CAPTURE_NAVIGATION_TIMEOUT_MS,
    });

    try {
      await page.waitForLoadState("load", { timeout: CAPTURE_LOAD_STATE_TIMEOUT_MS });
    } catch {
      /* 일부 사이트는 load 이벤트가 늦을 수 있어 domcontentloaded 이후 진행 */
    }

    await page.waitForTimeout(CAPTURE_STABILIZE_WAIT_MS);

    const finalUrl = page.url();
    assertSafeCaptureUrl(finalUrl);

    if (!response && page.url() === "about:blank") {
      throw new CaptureError("UNREACHABLE", "사이트에 접속할 수 없어요.", 502);
    }

    if (Date.now() - startedAt > CAPTURE_NAVIGATION_TIMEOUT_MS + CAPTURE_LOAD_STATE_TIMEOUT_MS) {
      throw new CaptureError(
        "SLOW_LOADING",
        "페이지 로딩이 너무 오래 걸려요. 잠시 후 다시 시도해주세요.",
        504
      );
    }

    return finalUrl;
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    if (isCaptureErrorLike(error)) throw error;
    throw mapPlaywrightError(error);
  }
}

function createDesktopContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: CAPTURE_DESKTOP_VIEWPORT,
    locale: CAPTURE_LOCALE,
    timezoneId: CAPTURE_TIMEZONE,
    ignoreHTTPSErrors: false,
  });
}

function createMobileContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    ...devices["iPhone 13"],
    locale: CAPTURE_LOCALE,
    timezoneId: CAPTURE_TIMEZONE,
    ignoreHTTPSErrors: false,
  });
}

async function captureFirstViewport(
  page: Page
): Promise<{ dataUrl: string; buffer: Buffer }> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(VIEWPORT_SETTLE_MS);
  await disableAnimations(page);

  try {
    const buffer = Buffer.from(
      await page.screenshot({
        fullPage: false,
        type: "png",
        timeout: CAPTURE_NAVIGATION_TIMEOUT_MS,
        animations: "disabled",
      })
    );
    return { dataUrl: bufferToDataUrl(buffer), buffer };
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    if (isCaptureErrorLike(error)) throw error;
    throw new CaptureError(
      "CAPTURE_FAILED",
      "첫 화면 캡처에 실패했어요. 페이지가 정상적으로 표시되는지 확인해주세요.",
      500
    );
  }
}

async function captureViewportAtScroll(
  page: Page,
  scrollY: number,
  overlayTracker: OverlayTracker,
  segmentIndex: number
): Promise<string> {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(SEGMENT_SETTLE_MS);

  const overlays = await collectAndTagVisibleOverlays(page);
  const isFirstSegment = segmentIndex === 0;
  const keysToHide = overlayTracker.register(scrollY, overlays, isFirstSegment);

  try {
    if (keysToHide.length > 0) {
      await hideOverlayKeys(page, keysToHide);
    }

    const buffer = await page.screenshot({
      fullPage: false,
      type: "png",
      timeout: CAPTURE_NAVIGATION_TIMEOUT_MS,
      animations: "disabled",
    });

    return bufferToDataUrl(Buffer.from(buffer));
  } finally {
    await restoreOverlayVisibility(page);
  }
}

async function captureSegments(
  page: Page,
  viewportHeight: number,
  maxHeight: number
): Promise<{ segments: CaptureSegment[]; stickyOverlays: StickyOverlayRecord[] }> {
  const segments: CaptureSegment[] = [];
  const scrollPositions: number[] = [];
  const overlayTracker = new OverlayTracker();

  for (let y = 0; y < maxHeight; y += viewportHeight) {
    scrollPositions.push(y);
  }

  for (let index = 0; index < scrollPositions.length; index += 1) {
    const scrollY = scrollPositions[index]!;
    const screenshot = await captureViewportAtScroll(page, scrollY, overlayTracker, index);
    segments.push({ scrollY, screenshot });
  }

  return { segments, stickyOverlays: overlayTracker.getRecords() };
}

function buildCapturedScreenshot(params: BuildScreenshotParams): CapturedScreenshot {
  const pngBuffer = params.buffer;
  const { width: imagePixelWidth, height: imagePixelHeight } = getPngDimensions(pngBuffer);

  return {
    imageDataUrl: bufferToDataUrl(pngBuffer),
    requestedUrl: params.meta.requestedUrl,
    finalUrl: params.finalUrl,
    userAgent: params.userAgent,
    viewportWidth: params.meta.viewportWidth,
    viewportHeight: params.meta.viewportHeight,
    deviceScaleFactor: params.meta.deviceScaleFactor,
    isMobile: params.meta.isMobile,
    hasTouch: params.meta.hasTouch,
    imagePixelWidth,
    imagePixelHeight,
    capturedAt: new Date().toISOString(),
    captureStatus: params.captureStatus,
    captureWarning: params.captureWarning,
    documentHeight: params.documentHeight,
    capturedHeight: params.capturedHeight,
    firstViewportScreenshot: params.firstViewportScreenshot,
    segments: params.segments,
    stickyOverlays: params.stickyOverlays,
  };
}

async function captureDeviceScreenshot(
  page: Page,
  meta: ContextCaptureMeta,
  finalUrl: string,
  userAgent: string
): Promise<CapturedScreenshot> {
  const { dataUrl: firstViewportScreenshot, buffer: firstViewportBuffer } =
    await captureFirstViewport(page);

  const initialHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const needsPartialPrep = initialHeight > MAX_FULL_PAGE_HEIGHT;

  await preparePageForFullScreenshot(
    page,
    needsPartialPrep ? { maxScrollHeight: MAX_CAPTURE_HEIGHT } : undefined
  );

  const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

  if (documentHeight <= MAX_FULL_PAGE_HEIGHT) {
    const buffer = await page.screenshot({
      fullPage: true,
      type: "png",
      timeout: CAPTURE_NAVIGATION_TIMEOUT_MS,
      animations: "disabled",
    });

    return buildCapturedScreenshot({
      buffer: Buffer.from(buffer),
      meta,
      finalUrl,
      userAgent,
      captureStatus: "full",
      documentHeight,
      capturedHeight: documentHeight,
      firstViewportScreenshot,
    });
  }

  const capturedHeight = Math.min(documentHeight, MAX_CAPTURE_HEIGHT);
  const { segments, stickyOverlays } = await captureSegments(
    page,
    meta.viewportHeight,
    capturedHeight
  );

  await page.evaluate(() => window.scrollTo(0, 0));

  return buildCapturedScreenshot({
    buffer: firstViewportBuffer,
    meta,
    finalUrl,
    userAgent,
    captureStatus: "partial",
    captureWarning: PARTIAL_CAPTURE_WARNING,
    documentHeight,
    capturedHeight,
    firstViewportScreenshot,
    segments,
    stickyOverlays,
  });
}

function desktopMeta(requestedUrl: string): ContextCaptureMeta {
  const preset = devices["Desktop Chrome"];
  return {
    requestedUrl,
    viewportWidth: CAPTURE_DESKTOP_VIEWPORT.width,
    viewportHeight: CAPTURE_DESKTOP_VIEWPORT.height,
    deviceScaleFactor: preset.deviceScaleFactor ?? 1,
    isMobile: preset.isMobile ?? false,
    hasTouch: preset.hasTouch ?? false,
  };
}

function mobileMeta(requestedUrl: string): ContextCaptureMeta {
  const preset = devices["iPhone 13"];
  const viewport = preset.viewport ?? { width: 390, height: 844 };
  return {
    requestedUrl,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    deviceScaleFactor: preset.deviceScaleFactor ?? 3,
    isMobile: preset.isMobile ?? true,
    hasTouch: preset.hasTouch ?? true,
  };
}

async function captureDesktop(
  browser: Browser,
  requestedUrl: string
): Promise<{ screenshot: CapturedScreenshot; title: string; finalUrl: string; pageData: PageCaptureData }> {
  let context: BrowserContext | undefined;

  try {
    context = await createDesktopContext(browser);
    const page = await context.newPage();
    const finalUrl = await navigateSafely(page, requestedUrl);
    const userAgent = await readUserAgent(page);
    const title = (await page.title()) || finalUrl;
    const screenshot = await captureDeviceScreenshot(
      page,
      desktopMeta(requestedUrl),
      finalUrl,
      userAgent
    );
    const pageData = await extractPageData(page);
    if (screenshot.stickyOverlays?.length) {
      pageData.stickyOverlays = screenshot.stickyOverlays;
    }

    return { screenshot, title, finalUrl, pageData };
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    if (isCaptureErrorLike(error)) throw error;
    throw mapPlaywrightError(error);
  } finally {
    await context?.close();
  }
}

async function captureMobile(browser: Browser, requestedUrl: string): Promise<CapturedScreenshot> {
  let context: BrowserContext | undefined;

  try {
    context = await createMobileContext(browser);
    const page = await context.newPage();
    const finalUrl = await navigateSafely(page, requestedUrl);
    const userAgent = await readUserAgent(page);
    assertMobileUserAgent(userAgent);

    return await captureDeviceScreenshot(page, mobileMeta(requestedUrl), finalUrl, userAgent);
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    if (isCaptureErrorLike(error)) throw error;
    throw mapPlaywrightError(error);
  } finally {
    await context?.close();
  }
}

export async function captureWebsite(
  rawUrl: string,
  onProgress?: ProgressCallback
): Promise<CaptureResult> {
  const normalizedInput = normalizeCaptureUrl(rawUrl);
  onProgress?.("connect");

  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ headless: true });

    onProgress?.("desktop-screenshot");
    const desktop = await captureDesktop(browser, normalizedInput);

    onProgress?.("mobile-screenshot");
    const mobileScreenshot = await captureMobile(browser, normalizedInput);

    onProgress?.("structure");

    return {
      normalizedUrl: desktop.finalUrl,
      title: desktop.title,
      desktopScreenshot: desktop.screenshot,
      mobileScreenshot,
      pageData: desktop.pageData,
    };
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    if (isCaptureErrorLike(error)) throw error;
    throw mapPlaywrightError(error);
  } finally {
    await browser?.close();
  }
}
