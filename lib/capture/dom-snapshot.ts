import type { Page } from "playwright";
import type { UrlDomSnapshot } from "@/lib/capture/url-types";

const MAX_HEADINGS = 60;
const MAX_INTERACTIVE = 150;
const MAX_NAV_LINKS = 100;
const MAX_FORMS = 20;
const MAX_TEXT_CHARS = 20_000;

function trimText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function collectDomSnapshot(page: Page): Promise<UrlDomSnapshot> {
  const raw = await page.evaluate(
    ({
      maxHeadings,
      maxInteractive,
      maxNavLinks,
      maxForms,
      maxTextChars,
    }) => {
      function isVisible(element: Element): boolean {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (element.getAttribute("aria-hidden") === "true") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function topOf(element: Element): number {
        const rect = element.getBoundingClientRect();
        return Math.round(rect.top + window.scrollY);
      }

      function normalize(text: string): string {
        return text.replace(/\s+/g, " ").trim();
      }

      function accessibleName(element: Element): string | null {
        const labelledBy = element.getAttribute("aria-labelledby");
        if (labelledBy) {
          const label = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" ");
          const normalized = normalize(label);
          if (normalized) return normalized;
        }
        const ariaLabel = element.getAttribute("aria-label");
        if (ariaLabel) return normalize(ariaLabel);
        const title = element.getAttribute("title");
        if (title) return normalize(title);
        const text = normalize(element.textContent ?? "");
        return text || null;
      }

      const lang = document.documentElement.lang || null;
      const title = document.title || null;
      const metaDescription =
        document.querySelector("meta[name='description']")?.getAttribute("content")?.trim() ||
        null;

      let textBudget = maxTextChars;

      function takeText(text: string): string {
        const normalized = normalize(text);
        if (!normalized) return "";
        if (normalized.length <= textBudget) {
          textBudget -= normalized.length;
          return normalized;
        }
        const clipped = normalized.slice(0, textBudget);
        textBudget = 0;
        return clipped;
      }

      const landmarks = Array.from(
        document.querySelectorAll("main, nav, header, footer, aside, [role='main'], [role='navigation'], [role='banner'], [role='contentinfo']")
      )
        .filter(isVisible)
        .slice(0, 40)
        .map((element, index) => ({
          id: `landmark-${index + 1}`,
          role: element.getAttribute("role") || element.tagName.toLowerCase(),
          label: accessibleName(element),
          top: topOf(element),
        }));

      const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
        .filter(isVisible)
        .slice(0, maxHeadings)
        .map((element, index) => {
          const level = Number(element.tagName.slice(1)) as 1 | 2 | 3;
          return {
            id: `heading-${index + 1}`,
            level,
            text: takeText(element.textContent ?? ""),
            top: topOf(element),
          };
        })
        .filter((item) => item.text.length > 0);

      const interactiveSelector =
        "a[href], button, input:not([type='hidden']), select, textarea, summary, [role='button'], [role='link'], [role='tab'], [role='menuitem'], [role='switch'], [role='checkbox'], [role='radio']";

      const interactiveElements = Array.from(document.querySelectorAll(interactiveSelector))
        .filter(isVisible)
        .slice(0, maxInteractive)
        .map((element, index) => {
          const htmlElement = element as HTMLElement;
          const input = element as HTMLInputElement;
          return {
            id: `interactive-${index + 1}`,
            role: element.getAttribute("role") || element.tagName.toLowerCase(),
            accessibleName: accessibleName(element),
            visibleText: takeText(element.textContent ?? ""),
            type: input.type ?? null,
            disabled:
              htmlElement.hasAttribute("disabled") ||
              htmlElement.getAttribute("aria-disabled") === "true",
            top: topOf(element),
          };
        })
        .filter((item) => (item.accessibleName ?? item.visibleText)?.length);

      const forms = Array.from(document.querySelectorAll("form"))
        .filter(isVisible)
        .slice(0, maxForms)
        .map((form, index) => ({
          id: `form-${index + 1}`,
          top: topOf(form),
          fields: Array.from(
            form.querySelectorAll("input:not([type='hidden']), select, textarea")
          )
            .filter(isVisible)
            .slice(0, 30)
            .map((field) => {
              const input = field as HTMLInputElement;
              const id = field.getAttribute("id");
              const label =
                (id ? document.querySelector(`label[for='${CSS.escape(id)}']`)?.textContent : null) ||
                field.getAttribute("aria-label");
              return {
                role: field.tagName.toLowerCase(),
                label: label ? normalize(label) : null,
                placeholder: input.placeholder ? normalize(input.placeholder) : null,
                required: input.required ?? false,
                disabled:
                  field.hasAttribute("disabled") ||
                  field.getAttribute("aria-disabled") === "true",
              };
            }),
        }))
        .filter((form) => form.fields.length > 0);

      const seenNav = new Set<string>();
      const navigationLinks = Array.from(document.querySelectorAll("a[href]"))
        .filter(isVisible)
        .slice(0, maxNavLinks * 2)
        .map((anchorEl) => {
          const anchor = anchorEl as HTMLAnchorElement;
          const text = takeText(anchor.textContent ?? "");
          if (!text) return null;
          let hrefPath: string | null = null;
          try {
            hrefPath = new URL(anchor.href, window.location.href).pathname;
          } catch {
            hrefPath = anchor.getAttribute("href");
          }
          const key = `${text}:${hrefPath ?? ""}`;
          if (seenNav.has(key)) return null;
          seenNav.add(key);
          return {
            text,
            hrefPath,
            top: topOf(anchor),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .slice(0, maxNavLinks);

      return {
        lang,
        title,
        metaDescription,
        landmarks,
        headings,
        interactiveElements,
        forms,
        navigationLinks,
      };
    },
    {
      maxHeadings: MAX_HEADINGS,
      maxInteractive: MAX_INTERACTIVE,
      maxNavLinks: MAX_NAV_LINKS,
      maxForms: MAX_FORMS,
      maxTextChars: MAX_TEXT_CHARS,
    }
  );

  return raw;
}

export function summarizeDomSnapshot(snapshot: UrlDomSnapshot): {
  headingCount: number;
  interactiveCount: number;
} {
  return {
    headingCount: snapshot.headings.length,
    interactiveCount: snapshot.interactiveElements.length,
  };
}

/** Observer/Reviewer 프롬프트용 — 전체 HTML은 포함하지 않습니다. */
export function formatDomSnapshotForPrompt(snapshot: UrlDomSnapshot): string {
  return JSON.stringify(snapshot);
}
