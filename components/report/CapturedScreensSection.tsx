"use client";

import { useMemo, useRef, useState } from "react";
import {
  ScreenshotDeviceFrame,
  ScreenshotZoomDialog,
  type SegmentedScrollHandle,
} from "@/components/report/ScreenshotDeviceFrame";
import { CaptureDebugPanel } from "@/components/report/CaptureDebugPanel";
import { PARTIAL_CAPTURE_BADGE } from "@/lib/capture-constants";
import {
  isPartialCapture,
  resolveCapturedScreenshot,
  type CaptureResult,
  type CapturedScreenshot,
} from "@/lib/capture-types";
import { buildSegmentDisplayMetadata, hasSegmentedCapture } from "@/lib/segment-display";
import { DEVICE_META } from "@/lib/types";
import { cn } from "@/lib/utils";

type DeviceView = "desktop" | "mobile";

interface CapturedScreensSectionProps {
  capture: CaptureResult;
}

function PartialCaptureBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
      {PARTIAL_CAPTURE_BADGE}
    </span>
  );
}

function SegmentNavigator({
  screenshot,
  onJump,
}: {
  screenshot: CapturedScreenshot;
  onJump: (index: number) => void;
}) {
  if (!hasSegmentedCapture(screenshot) || !screenshot.segments) {
    return null;
  }

  const metadata = buildSegmentDisplayMetadata(
    screenshot.segments,
    screenshot.viewportHeight
  );

  return (
    <details className="mt-3 rounded-lg border border-border bg-surface-alt/40">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink hover:bg-surface-alt">
        구간 이동
      </summary>
      <ul className="space-y-1 border-t border-border px-2 py-2">
        {metadata.items.map((item, index) => (
          <li key={item.anchorId}>
            <button
              type="button"
              onClick={() => onJump(index)}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function CapturedScreensSection({ capture }: CapturedScreensSectionProps) {
  const [activeView, setActiveView] = useState<DeviceView>("desktop");
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomButtonRef = useRef<HTMLButtonElement>(null);
  const mobileFrameRef = useRef<SegmentedScrollHandle>(null);
  const desktopFrameRef = useRef<SegmentedScrollHandle>(null);

  const desktopShot = resolveCapturedScreenshot(
    capture.desktopScreenshot,
    "desktop",
    capture.normalizedUrl
  );
  const mobileShot = resolveCapturedScreenshot(
    capture.mobileScreenshot,
    "mobile",
    capture.normalizedUrl
  );

  const showPartialBadge = useMemo(() => isPartialCapture(capture), [capture]);

  if (!desktopShot || !mobileShot) {
    return null;
  }

  const activeShot = activeView === "desktop" ? desktopShot : mobileShot;
  const label = activeView === "desktop" ? "Desktop Screenshot" : "Mobile Screenshot";
  const viewportLabel = DEVICE_META[activeView].viewport;
  const isActivePartial = activeShot.captureStatus === "partial";

  function scrollToSegment(index: number) {
    if (activeView === "mobile") {
      mobileFrameRef.current?.scrollToSegment(index);
    } else {
      desktopFrameRef.current?.scrollToSegment(index);
    }
  }

  return (
    <section
      aria-labelledby="captured-screens-heading"
      className="rounded-xl border border-border bg-surface p-6 shadow-panel sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="captured-screens-heading" className="text-lg font-semibold text-ink">
            실제 화면
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Playwright로 캡처한 실제 페이지 화면입니다.</p>
        </div>
        {showPartialBadge ? <PartialCaptureBadge /> : null}
      </div>

      {showPartialBadge ? (
        <p className="mt-3 text-sm text-amber-900">
          {capture.desktopScreenshot.captureWarning ?? capture.mobileScreenshot.captureWarning}
        </p>
      ) : null}

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">페이지 제목</dt>
          <dd className="mt-1 text-sm text-ink">{capture.title}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">분석 URL</dt>
          <dd className="mt-1 truncate font-mono text-sm text-ink" title={capture.normalizedUrl}>
            {capture.normalizedUrl}
          </dd>
        </div>
      </dl>

      <div
        role="tablist"
        aria-label="캡처 화면 전환"
        className="mt-6 flex flex-wrap gap-2 border-b border-border pb-3"
      >
        {(["desktop", "mobile"] as const).map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={activeView === view}
            onClick={() => setActiveView(view)}
            className={cn(
              "min-h-11 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
              activeView === view
                ? "border-ink bg-ink text-white"
                : "border-border bg-surface text-ink-muted hover:bg-surface-alt"
            )}
          >
            {view === "desktop" ? "Desktop" : "Mobile"}
            <span className="ml-1.5 font-mono text-[10px] opacity-80">
              {DEVICE_META[view].viewport}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">{label}</p>
            <p className="font-mono text-xs text-ink-muted">{viewportLabel}</p>
            {isActivePartial ? (
              <p className="mt-1 text-xs text-ink-muted">
                문서 높이 {activeShot.documentHeight.toLocaleString()}px · 캡처{" "}
                {activeShot.capturedHeight.toLocaleString()}px
              </p>
            ) : null}
          </div>
          <button
            ref={zoomButtonRef}
            type="button"
            onClick={() => setZoomOpen(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            확대 보기
          </button>
        </div>

        {hasSegmentedCapture(activeShot) ? (
          <SegmentNavigator screenshot={activeShot} onJump={scrollToSegment} />
        ) : null}

        <div className="mt-4">
          <ScreenshotDeviceFrame
            screenshot={activeShot}
            device={activeView}
            mobileFrameRef={mobileFrameRef}
            desktopFrameRef={desktopFrameRef}
          />
        </div>
      </div>

      <ScreenshotZoomDialog
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        returnFocusRef={zoomButtonRef}
        screenshot={activeShot}
        device={activeView}
        title={capture.title}
      />

      <CaptureDebugPanel desktop={desktopShot} mobile={mobileShot} />
    </section>
  );
}
