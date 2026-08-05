import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";
import { MAX_FULL_PAGE_HEIGHT } from "@/lib/capture-constants";
import { CaptureError, mapPlaywrightError } from "@/lib/capture-errors";
import { collectDomSnapshot } from "@/lib/capture/dom-snapshot";
import type { CapturedUrlPage, UrlCaptureDeviceType } from "@/lib/capture/url-types";
import { UrlReviewError } from "@/lib/capture/url-review-errors";
import {
  assertSafePublicUrl,
  assertSafeRedirectUrl,
  normalizePublicUrl,
} from "@/lib/capture/validate-public-url";
import { getPngDimensions } from "@/lib/png-dimensions";
import { disableAnimations, preparePageForFullScreenshot } from "@/lib/prepare-page-screenshot";

import {
  CAPTURE_DESKTOP_VIEWPORT,
  CAPTURE_FONT_WAIT_MS,
  CAPTURE_LOAD_STATE_TIMEOUT_MS,
  CAPTURE_LOCALE,
  CAPTURE_NAVIGATION_TIMEOUT_MS,
  CAPTURE_STABILIZE_WAIT_MS,
  CAPTURE_TIMEZONE,
} from "@/lib/capture/capture-config";

const ACCESS_BLOCKED_PATTERNS = [
  /captcha/i,
  /access denied/i,
  /bot detected/i,
  /verify you are human/i,
  /cloudflare/i,
  /attention required/i,
  /forbidden/i,
];

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

function mapCaptureError(error: unknown): never {
  if (error instanceof UrlReviewError) throw error;
  if (error instanceof CaptureError) {
    if (error.code === "BLOCKED_URL") {
      throw new UrlReviewError("PRIVATE_ADDRESS_BLOCKED", error.message, error.status);
    }
    if (error.code === "TIMEOUT" || error.code === "SLOW_LOADING") {
      throw new UrlReviewError("CAPTURE_TIMEOUT", "페이지 로딩 시간이 초과됐어요.", error.status);
    }
    if (error.code === "UNREACHABLE" || error.code === "SSL_ERROR") {
      throw new UrlReviewError("PAGE_UNAVAILABLE", error.message, error.status);
    }
    throw new UrlReviewError("PAGE_UNAVAILABLE", error.message, error.status);
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    throw new UrlReviewError("CAPTURE_TIMEOUT", "페이지 로딩 시간이 초과됐어요.", 504);
  }
  throw mapPlaywrightError(error);
}

async function waitForFonts(page: Page): Promise<void> {
  try {
    await page.evaluate(async (timeoutMs) => {
      if (!document.fonts?.ready) return;
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    }, CAPTURE_FONT_WAIT_MS);
  } catch {
    /* fonts API unavailable */
  }
}

async function configurePage(page: Page): Promise<void> {
  page.on("popup", async (popup) => {
    await popup.close().catch(() => undefined);
  });

  await page.route("**/*", (route) => {
    if (route.request().resourceType() === "download") {
      void route.abort();
      return;
    }
    void route.continue();
  });
}

async function createIsolatedContext(
  browser: Browser,
  deviceType: UrlCaptureDeviceType
): Promise<BrowserContext> {
  const base =
    deviceType === "mobile"
      ? {
          ...devices["iPhone 13"],
          locale: CAPTURE_LOCALE,
          timezoneId: CAPTURE_TIMEZONE,
          ignoreHTTPSErrors: false,
        }
      : {
          ...devices["Desktop Chrome"],
          viewport: CAPTURE_DESKTOP_VIEWPORT,
          locale: CAPTURE_LOCALE,
          timezoneId: CAPTURE_TIMEZONE,
          ignoreHTTPSErrors: false,
        };

  const context = await browser.newContext({
    ...base,
    acceptDownloads: false,
    permissions: [],
  });

  await context.grantPermissions([], { origin: "https://example.com" }).catch(() => undefined);

  return context;
}

async function navigateSafely(page: Page, url: string, signal?: AbortSignal): Promise<string> {
  throwIfAborted(signal);
  await assertSafePublicUrl(url);

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: CAPTURE_NAVIGATION_TIMEOUT_MS,
    });

    try {
      await page.waitForLoadState("load", { timeout: CAPTURE_LOAD_STATE_TIMEOUT_MS });
    } catch {
      /* continue */
    }

    await waitForFonts(page);
    await page.waitForTimeout(CAPTURE_STABILIZE_WAIT_MS);

    const finalUrl = page.url();
    await assertSafeRedirectUrl(finalUrl);

    if (!response && page.url() === "about:blank") {
      throw new UrlReviewError("PAGE_UNAVAILABLE", "페이지에 접속할 수 없어요.", 502);
    }

    return finalUrl;
  } catch (error) {
    return mapCaptureError(error);
  }
}

async function detectAccessBlocked(page: Page): Promise<void> {
  const probe = await page.evaluate(() => ({
    title: document.title ?? "",
    bodyText: (document.body?.innerText ?? "").slice(0, 1500),
  }));

  const combined = `${probe.title}\n${probe.bodyText}`;
  if (ACCESS_BLOCKED_PATTERNS.some((pattern) => pattern.test(combined))) {
    throw new UrlReviewError(
      "ACCESS_BLOCKED",
      "접근이 제한된 페이지예요. 공개 페이지 URL을 입력해주세요.",
      422
    );
  }
}

async function captureFullPageBuffer(page: Page): Promise<Buffer> {
  const initialHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const needsPartialPrep = initialHeight > MAX_FULL_PAGE_HEIGHT;

  await preparePageForFullScreenshot(
    page,
    needsPartialPrep ? { maxScrollHeight: MAX_FULL_PAGE_HEIGHT } : undefined
  );

  const buffer = Buffer.from(
    await page.screenshot({
      fullPage: true,
      type: "png",
      timeout: CAPTURE_NAVIGATION_TIMEOUT_MS,
      animations: "disabled",
    })
  );

  return buffer;
}

function assertNonEmptyPage(snapshot: Awaited<ReturnType<typeof collectDomSnapshot>>): void {
  const hasStructure =
    snapshot.headings.length > 0 ||
    snapshot.interactiveElements.length > 0 ||
    snapshot.navigationLinks.length > 0 ||
    snapshot.landmarks.length > 0;

  if (!hasStructure) {
    throw new UrlReviewError("EMPTY_PAGE", "분석할 수 있는 화면 콘텐츠를 찾지 못했어요.", 502);
  }
}

export async function capturePublicUrl(input: {
  url: string;
  deviceType: UrlCaptureDeviceType;
  signal?: AbortSignal;
}): Promise<CapturedUrlPage> {
  throwIfAborted(input.signal);

  const normalized = normalizePublicUrl(input.url);
  await assertSafePublicUrl(normalized.toString());

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    context = await createIsolatedContext(browser, input.deviceType);
    const page = await context.newPage();
    await configurePage(page);

    throwIfAborted(input.signal);
    const finalUrl = await navigateSafely(page, normalized.toString(), input.signal);

    throwIfAborted(input.signal);
    await detectAccessBlocked(page);

    throwIfAborted(input.signal);
    const domSnapshot = await collectDomSnapshot(page);
    assertNonEmptyPage(domSnapshot);

    throwIfAborted(input.signal);
    await disableAnimations(page);
    const fullPageImage = await captureFullPageBuffer(page);
    const { width, height } = getPngDimensions(fullPageImage);

    const viewport =
      input.deviceType === "mobile"
        ? devices["iPhone 13"].viewport ?? { width: 390, height: 844 }
        : CAPTURE_DESKTOP_VIEWPORT;

    const deviceScaleFactor =
      input.deviceType === "mobile"
        ? devices["iPhone 13"].deviceScaleFactor ?? 3
        : devices["Desktop Chrome"].deviceScaleFactor ?? 1;

    return {
      requestedUrl: normalized.toString(),
      finalUrl,
      pageTitle: domSnapshot.title,
      viewport: {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor,
      },
      fullPageImage,
      mimeType: "image/png",
      width,
      height,
      domSnapshot,
    };
  } catch (error) {
    return mapCaptureError(error);
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}
