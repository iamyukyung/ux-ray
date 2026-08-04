import type { Page } from "playwright";
import {
  MAX_CAPTURE_HEIGHT,
  MAX_SCROLL_DURATION_MS,
  MAX_SCROLL_ITERATIONS,
  STABLE_HEIGHT_THRESHOLD,
} from "./capture-constants";

const SCROLL_WAIT_MIN_MS = 200;
const SCROLL_WAIT_MAX_MS = 400;
const TOP_RESET_WAIT_MS = 500;
const IMAGE_LOAD_TIMEOUT_MS = 5_000;

export interface PreparePageOptions {
  /** 스크롤·lazy-load를 이 높이(CSS px)까지만 진행 */
  maxScrollHeight?: number;
}

function randomScrollWaitMs(): number {
  return SCROLL_WAIT_MIN_MS + Math.floor(Math.random() * (SCROLL_WAIT_MAX_MS - SCROLL_WAIT_MIN_MS + 1));
}

/**
 * lazy-loaded 콘텐츠를 불러온 뒤 fullPage 스크린샷을 찍을 수 있도록 페이지를 준비합니다.
 */
export async function preparePageForFullScreenshot(
  page: Page,
  options?: PreparePageOptions
): Promise<void> {
  await scrollToLoadLazyContent(page, options?.maxScrollHeight);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(TOP_RESET_WAIT_MS);
  await waitForFontsAndImages(page);
  await disableAnimations(page);
}

async function scrollToLoadLazyContent(page: Page, maxScrollHeight?: number): Promise<void> {
  const heightLimit = maxScrollHeight ?? MAX_CAPTURE_HEIGHT;
  const startedAt = Date.now();
  let iterations = 0;
  let stableHeightCount = 0;
  let lastDocumentHeight = 0;

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  while (iterations < MAX_SCROLL_ITERATIONS && Date.now() - startedAt < MAX_SCROLL_DURATION_MS) {
    const metrics = await page.evaluate(() => ({
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
    }));

    if (metrics.scrollY + metrics.viewportHeight >= heightLimit) {
      break;
    }

    const scrollStep = Math.floor(metrics.viewportHeight * 0.75);
    const atBottom = metrics.scrollY + metrics.viewportHeight >= metrics.documentHeight - 2;

    if (metrics.documentHeight > lastDocumentHeight) {
      lastDocumentHeight = metrics.documentHeight;
      stableHeightCount = 0;
    } else if (atBottom) {
      stableHeightCount += 1;
      if (stableHeightCount >= STABLE_HEIGHT_THRESHOLD) {
        break;
      }
    }

    if (atBottom && stableHeightCount >= STABLE_HEIGHT_THRESHOLD) {
      break;
    }

    await page.evaluate((step) => {
      window.scrollBy(0, step);
    }, scrollStep);

    await page.waitForTimeout(randomScrollWaitMs());

    const nextHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    if (nextHeight > lastDocumentHeight) {
      lastDocumentHeight = nextHeight;
      stableHeightCount = 0;
    }

    iterations += 1;
  }
}

async function waitForFontsAndImages(page: Page): Promise<void> {
  await page.evaluate(async (imageTimeoutMs) => {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* fonts API failure should not block capture */
      }
    }

    const images = Array.from(document.images);
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }

            const finish = () => {
              img.removeEventListener("load", finish);
              img.removeEventListener("error", finish);
              resolve();
            };

            img.addEventListener("load", finish);
            img.addEventListener("error", finish);
            window.setTimeout(finish, imageTimeoutMs);
          })
      )
    );
  }, IMAGE_LOAD_TIMEOUT_MS);
}

export async function disableAnimations(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.querySelector("style[data-ux-ray-capture]")) return;

    const style = document.createElement("style");
    style.setAttribute("data-ux-ray-capture", "true");
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    document.head.appendChild(style);
  });
}
