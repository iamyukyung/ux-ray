"use client";

import { Button } from "@/components/ui/Button";
import {
  isUrlMobileCapture,
  MOBILE_CAPTURE_PREVIEW_FRAME_CLASS,
  MOBILE_CAPTURE_PREVIEW_MAX_WIDTH_CLASS,
} from "@/lib/capture-preview-utils";
import {
  SCREEN_DEVICE_LABELS,
  type ScreenshotReviewReport,
  type UploadedScreen,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export type UrlAssetLoadState = "idle" | "loading" | "ready" | "missing";

function logPreviewImageError(input: {
  reviewId?: string;
  screenId?: string;
  previewUrl: string;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[url-review:preview-render-error]", {
    reviewId: input.reviewId ?? "unknown",
    screenId: input.screenId ?? "unknown",
    hasObjectUrl: input.previewUrl.startsWith("blob:"),
  });
}

interface UrlCapturedPageSectionProps {
  report: ScreenshotReviewReport;
  screen: UploadedScreen | null;
  assetLoadState: UrlAssetLoadState;
  onZoom: (screen: UploadedScreen) => void;
}

export function UrlCapturedPageSection({
  report,
  screen,
  assetLoadState,
  onZoom,
}: UrlCapturedPageSectionProps) {
  const urlSource = report.source;
  const assetRef = report.screenAssets?.[0];
  const isMobileCapture = isUrlMobileCapture(report);

  return (
    <section
      aria-labelledby="url-captured-page-heading"
      className="rounded-xl border border-border bg-surface p-5 shadow-panel sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="url-captured-page-heading" className="text-base font-semibold text-ink">
            캡처된 페이지
          </h2>
          {urlSource ? (
            <dl className="mt-3 grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
              {urlSource.pageTitle ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide">페이지 제목</dt>
                  <dd className="mt-0.5 text-ink">{urlSource.pageTitle}</dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide">최종 URL</dt>
                <dd className="mt-0.5 break-all text-ink">{urlSource.finalUrl}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide">기기 유형</dt>
                <dd className="mt-0.5 text-ink">
                  {SCREEN_DEVICE_LABELS[urlSource.deviceType]}
                </dd>
              </div>
              {assetRef ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide">캡처 크기</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {assetRef.originalWidth}×{assetRef.originalHeight}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
        {screen ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => onZoom(screen)}
          >
            전체 화면 보기
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-4",
          isMobileCapture && cn("mx-auto w-full", MOBILE_CAPTURE_PREVIEW_MAX_WIDTH_CLASS, "lg:mx-0")
        )}
      >
        {assetLoadState === "loading" ? (
          <div
            className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-alt/50"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm text-ink-muted">캡처 이미지를 불러오는 중…</p>
          </div>
        ) : null}

        {assetLoadState === "missing" ? (
          <div
            className="rounded-lg border border-border bg-surface-alt/50 px-4 py-5 text-sm leading-relaxed text-ink-muted"
            role="status"
          >
            캡처 이미지를 불러오지 못했어요. 분석 결과는 계속 확인할 수 있습니다.
          </div>
        ) : null}

        {assetLoadState === "ready" && screen ? (
          <>
            <button
              type="button"
              onClick={() => onZoom(screen)}
              className={cn(
                "group block w-full overflow-hidden rounded-lg border border-border bg-surface-alt/30 text-left",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              )}
              aria-label={`${screen.screenName} 전체 화면 보기`}
            >
              <div
                className={cn(
                  "overflow-y-auto overflow-x-hidden overscroll-contain",
                  isMobileCapture
                    ? MOBILE_CAPTURE_PREVIEW_FRAME_CLASS
                    : "max-h-[min(70vh,720px)]"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screen.previewUrl}
                  alt={`${screen.screenName} 캡처`}
                  className="block h-auto w-full"
                  onError={() =>
                    logPreviewImageError({
                      screenId: screen.id,
                      previewUrl: screen.previewUrl,
                    })
                  }
                />
              </div>
              <p className="border-t border-border px-4 py-2 text-xs text-ink-muted group-hover:text-ink">
                {isMobileCapture
                  ? "프레임 안에서 스크롤하거나 클릭해 전체 화면으로 볼 수 있어요."
                  : "클릭하면 전체 화면으로 확대해 볼 수 있어요."}
              </p>
            </button>
            {isMobileCapture ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-3 min-h-11 w-full"
                onClick={() => onZoom(screen)}
              >
                전체 화면 보기
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
