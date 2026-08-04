import type { Page } from "playwright";
import type { StickyOverlayRecord } from "./capture-types";

export interface CollectedOverlay {
  overlayKey: string;
  stableId: string;
  stateKey: string;
  position: "fixed" | "sticky";
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
}

export class OverlayTracker {
  private records = new Map<string, StickyOverlayRecord>();

  /** segment 캡처 직전 — 반복 overlay 키 목록 반환 (첫 segment는 항상 빈 배열) */
  register(scrollY: number, overlays: CollectedOverlay[], isFirstSegment: boolean): string[] {
    const toHide: string[] = [];

    for (const overlay of overlays) {
      const existing = this.records.get(overlay.overlayKey);

      if (existing) {
        existing.repeatCount += 1;
        if (!isFirstSegment) {
          toHide.push(overlay.overlayKey);
        }
      } else {
        this.records.set(overlay.overlayKey, {
          stableId: overlay.stableId,
          stateKey: overlay.stateKey,
          position: overlay.position,
          text: overlay.text,
          boundingBox: overlay.boundingBox,
          firstSeenScrollY: scrollY,
          repeatCount: 0,
        });
      }
    }

    return toHide;
  }

  getRecords(): StickyOverlayRecord[] {
    return Array.from(this.records.values());
  }
}

/**
 * viewport 내 fixed/sticky 요소를 탐지하고 캡처용 data attribute를 부여합니다.
 * evaluate 내부에 named/nested function을 두지 않습니다 (esbuild __name 이슈 회피).
 */
export async function collectAndTagVisibleOverlays(page: Page): Promise<CollectedOverlay[]> {
  return page.evaluate(() => {
    const results: Array<{
      overlayKey: string;
      stableId: string;
      stateKey: string;
      position: "fixed" | "sticky";
      text: string;
      boundingBox: { x: number; y: number; width: number; height: number };
    }> = [];

    const elements = document.querySelectorAll("*");
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    for (let i = 0; i < elements.length; i += 1) {
      const el = elements[i] as HTMLElement;
      const style = window.getComputedStyle(el);
      const position = style.position;

      if (position !== "fixed" && position !== "sticky") continue;
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        continue;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.bottom <= 0 || rect.top >= vh || rect.right <= 0 || rect.left >= vw) continue;

      let stableId = "";
      if (el.id) {
        stableId = `id:${el.id}`;
      } else {
        let dataAttr = "";
        for (let a = 0; a < el.attributes.length; a += 1) {
          const attr = el.attributes[a]!;
          if (attr.name.startsWith("data-") && !attr.name.startsWith("data-ux-ray-")) {
            dataAttr = `data:${attr.name}=${attr.value.slice(0, 80)}`;
            break;
          }
        }

        if (dataAttr) {
          stableId = dataAttr;
        } else {
          const parts: string[] = [];
          let node: Element | null = el;
          while (node && node.nodeType === 1 && parts.length < 6) {
            let part = node.tagName.toLowerCase();
            if (node.className && typeof node.className === "string") {
              const cls = node.className.trim().split(/\s+/).slice(0, 2).join(".");
              if (cls) part += `.${cls}`;
            }
            parts.unshift(part);
            node = node.parentElement;
          }
          stableId = `path:${parts.join(">")}`;
        }
      }

      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
      const stateKey = `${text}|${Math.round(rect.width)}|${Math.round(rect.height)}`;
      const overlayKey = `${stableId}|${stateKey}`;

      el.setAttribute("data-ux-ray-overlay-key", overlayKey);

      results.push({
        overlayKey,
        stableId,
        stateKey,
        position: position as "fixed" | "sticky",
        text,
        boundingBox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      });
    }

    return results;
  });
}

/** 연속 미리보기용 segment 캡처 직전 — 반복 overlay만 visibility:hidden */
export async function hideOverlayKeys(page: Page, keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  await page.evaluate((keysToHide) => {
    const hidden = document.querySelectorAll("[data-ux-ray-overlay-key]");
    for (let i = 0; i < hidden.length; i += 1) {
      const el = hidden[i] as HTMLElement;
      const key = el.getAttribute("data-ux-ray-overlay-key");
      if (!key || !keysToHide.includes(key)) continue;
      if (!el.hasAttribute("data-ux-ray-overlay-prev-vis")) {
        el.setAttribute("data-ux-ray-overlay-prev-vis", el.style.visibility || "");
        el.style.visibility = "hidden";
      }
    }
  }, keys);
}

/** 캡처 후 overlay visibility 복원 */
export async function restoreOverlayVisibility(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hidden = document.querySelectorAll("[data-ux-ray-overlay-prev-vis]");
    for (let i = 0; i < hidden.length; i += 1) {
      const el = hidden[i] as HTMLElement;
      el.style.visibility = el.getAttribute("data-ux-ray-overlay-prev-vis") || "";
      el.removeAttribute("data-ux-ray-overlay-prev-vis");
    }
  });
}
