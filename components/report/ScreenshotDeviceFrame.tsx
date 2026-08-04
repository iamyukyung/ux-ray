"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CapturedScreenshot } from "@/lib/capture-types";
import {
  buildSegmentDisplayMetadata,
  hasSegmentedCapture,
  type SegmentDisplayItem,
} from "@/lib/segment-display";
import { cn } from "@/lib/utils";

type PreviewMode = "device" | "full";
type FrameVariant = "preview" | "scrollable";

const MOBILE_FRAME_WIDTH = 390;
const MOBILE_FRAME_HEIGHT = 844;

export interface SegmentedScrollHandle {
  scrollToSegment: (index: number) => void;
}

function createScrollHandle(
  scrollRef: React.RefObject<HTMLDivElement>,
  segmentRefs: React.MutableRefObject<Map<number, HTMLElement>>
): SegmentedScrollHandle {
  return {
    scrollToSegment(index: number) {
      const container = scrollRef.current;
      const target = segmentRefs.current.get(index);
      if (!container || !target) return;
      container.scrollTo({ top: target.offsetTop, behavior: "smooth" });
    },
  };
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const scrollY = window.scrollY;
    const { overflow, position, top, width, paddingRight } = document.body.style;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = overflow;
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      document.body.style.paddingRight = paddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

function SegmentedStack({
  items,
  viewportHeight,
  showFoldGuide,
  gapWarnings,
  duplicateRegionNotice,
  segmentRefs,
}: {
  items: SegmentDisplayItem[];
  viewportHeight: number;
  showFoldGuide: boolean;
  gapWarnings: string[];
  duplicateRegionNotice: boolean;
  segmentRefs?: React.MutableRefObject<Map<number, HTMLElement>>;
}) {
  return (
    <div className="relative">
      {showFoldGuide ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-start justify-center border-t border-dashed border-accent/60 bg-accent/5"
          style={{ top: viewportHeight }}
          aria-hidden="true"
        >
          <span className="-translate-y-1/2 bg-white px-2 text-[10px] font-medium tracking-wide text-accent">
            첫 화면 끝 · Fold
          </span>
        </div>
      ) : null}

      {items.map((item, index) => (
        <div key={item.anchorId}>
          {item.gapBeforePx > 0 ? (
            <div
              className="flex items-center justify-center bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-900"
              role="note"
            >
              약 {Math.round(item.gapBeforePx)}px 구간 미캡처
            </div>
          ) : null}
          <div
            ref={(element) => {
              if (element) segmentRefs?.current.set(index, element);
              else segmentRefs?.current.delete(index);
            }}
            id={item.anchorId}
            data-segment-index={index}
            style={item.overlapTopPx > 0 ? { marginTop: -item.overlapTopPx } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.screenshot}
              alt={item.label}
              draggable={false}
              className="m-0 block h-auto w-full"
              style={
                item.overlapTopPx > 0
                  ? { clipPath: `inset(${item.overlapTopPx}px 0 0 0)` }
                  : undefined
              }
            />
          </div>
        </div>
      ))}

      {gapWarnings.length > 0 ? (
        <p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900" role="note">
          {gapWarnings.join(" ")}
        </p>
      ) : null}

      {duplicateRegionNotice ? (
        <p className="border-t border-border bg-surface-alt px-3 py-2 text-[11px] text-ink-muted" role="note">
          고정 헤더·내비게이션 등이 구간마다 반복될 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}

function CaptureScrollContent({
  screenshot,
  showFoldGuide = true,
  segmentRefs,
}: {
  screenshot: CapturedScreenshot;
  showFoldGuide?: boolean;
  segmentRefs?: React.MutableRefObject<Map<number, HTMLElement>>;
}) {
  const segmented = hasSegmentedCapture(screenshot);

  if (segmented && screenshot.segments) {
    const metadata = buildSegmentDisplayMetadata(screenshot.segments, screenshot.viewportHeight);
    return (
      <SegmentedStack
        items={metadata.items}
        viewportHeight={screenshot.viewportHeight}
        showFoldGuide={showFoldGuide}
        gapWarnings={metadata.gapWarnings}
        duplicateRegionNotice={metadata.duplicateRegionNotice}
        segmentRefs={segmentRefs}
      />
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={screenshot.imageDataUrl}
      alt=""
      draggable={false}
      className="block h-auto w-full"
      style={{ objectPosition: "top" }}
    />
  );
}

function DesktopDeviceFrame({
  screenshot,
  variant,
  frameClassName,
  segmentRefs,
  scrollRef,
}: {
  screenshot: CapturedScreenshot;
  variant: FrameVariant;
  frameClassName?: string;
  segmentRefs?: React.MutableRefObject<Map<number, HTMLElement>>;
  scrollRef?: React.Ref<HTMLDivElement>;
}) {
  const { viewportWidth, viewportHeight } = screenshot;
  const segmented = hasSegmentedCapture(screenshot);
  const previewHeight = Math.min(viewportHeight, 560);
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = scrollRef ?? internalScrollRef;

  return (
    <div
      className={cn(
        "mx-auto overflow-hidden rounded-xl border border-border bg-ink shadow-card",
        "w-full max-w-[720px]",
        frameClassName
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        </div>
        <span className="font-mono text-[10px] text-white/50">
          {viewportWidth}×{viewportHeight}
        </span>
      </div>

      <div
        ref={containerRef}
        className="overflow-x-hidden overflow-y-auto overscroll-contain bg-white"
        style={{
          width: "100%",
          height: segmented || variant === "scrollable" ? previewHeight : viewportHeight,
          maxHeight: previewHeight,
        }}
      >
        <CaptureScrollContent
          screenshot={screenshot}
          segmentRefs={segmentRefs}
        />
      </div>
    </div>
  );
}

const MobileDeviceFrameContent = forwardRef<
  SegmentedScrollHandle,
  {
    screenshot: CapturedScreenshot;
    variant: FrameVariant;
    labelViewportWidth?: number;
    labelViewportHeight?: number;
    segmentRefs?: React.MutableRefObject<Map<number, HTMLElement>>;
  }
>(function MobileDeviceFrameContent(
  {
    screenshot,
    variant,
    labelViewportWidth = MOBILE_FRAME_WIDTH,
    labelViewportHeight = MOBILE_FRAME_HEIGHT,
    segmentRefs,
  },
  ref
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const internalSegmentRefs = useRef<Map<number, HTMLElement>>(new Map());
  const refs = segmentRefs ?? internalSegmentRefs;

  useImperativeHandle(ref, () => ({
    scrollToSegment(index: number) {
      const target = refs.current.get(index);
      const container = scrollRef.current;
      if (!target || !container) return;
      container.scrollTo({ top: target.offsetTop, behavior: "smooth" });
    },
  }));

  return (
    <div
      className="flex flex-shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-ink shadow-card"
      style={{
        width: MOBILE_FRAME_WIDTH,
        height: MOBILE_FRAME_HEIGHT,
      }}
    >
      <div className="flex flex-shrink-0 items-center justify-center gap-2 border-b border-white/10 px-3 py-2">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <span className="font-mono text-[10px] text-white/50">
          {labelViewportWidth}×{labelViewportHeight}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-white"
      >
        <CaptureScrollContent
          screenshot={screenshot}
          segmentRefs={refs}
        />
      </div>
    </div>
  );
});

function ScaledMobileDeviceFrame({
  screenshot,
  className,
  maxAvailableWidth,
  maxAvailableHeight,
  mobileFrameRef,
  segmentRefs,
}: {
  screenshot: CapturedScreenshot;
  className?: string;
  maxAvailableWidth?: number;
  maxAvailableHeight?: number;
  mobileFrameRef?: React.Ref<SegmentedScrollHandle>;
  segmentRefs?: React.MutableRefObject<Map<number, HTMLElement>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateScale = () => {
      const availableWidth = maxAvailableWidth ?? element.clientWidth;
      const availableHeight = maxAvailableHeight ?? element.clientHeight;

      if (availableWidth <= 0 || availableHeight <= 0) {
        setScale(1);
        return;
      }

      const nextScale = Math.min(
        1,
        availableWidth / MOBILE_FRAME_WIDTH,
        availableHeight / MOBILE_FRAME_HEIGHT
      );

      setScale(nextScale);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    return () => observer.disconnect();
  }, [maxAvailableWidth, maxAvailableHeight]);

  const scaledWidth = MOBILE_FRAME_WIDTH * scale;
  const scaledHeight = MOBILE_FRAME_HEIGHT * scale;

  return (
    <div ref={containerRef} className={cn("flex w-full items-start justify-center", className)}>
      <div style={{ width: scaledWidth, height: scaledHeight, flexShrink: 0 }}>
        <div
          style={{
            width: MOBILE_FRAME_WIDTH,
            height: MOBILE_FRAME_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <MobileDeviceFrameContent
            ref={mobileFrameRef}
            screenshot={screenshot}
            variant="scrollable"
            labelViewportWidth={screenshot.viewportWidth}
            labelViewportHeight={screenshot.viewportHeight}
            segmentRefs={segmentRefs}
          />
        </div>
      </div>
    </div>
  );
}

function FullPagePreview({
  screenshot,
  title,
  label,
}: {
  screenshot: CapturedScreenshot;
  title: string;
  label: string;
}) {
  const segmented = hasSegmentedCapture(screenshot);

  if (segmented && screenshot.segments) {
    const metadata = buildSegmentDisplayMetadata(screenshot.segments, screenshot.viewportHeight);
    return (
      <div className="w-full">
        <SegmentedStack
          items={metadata.items}
          viewportHeight={screenshot.viewportHeight}
          showFoldGuide
          gapWarnings={metadata.gapWarnings}
          duplicateRegionNotice={metadata.duplicateRegionNotice}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={screenshot.imageDataUrl}
        alt={`${title} — ${label} 전체 페이지`}
        className="mx-auto block h-auto w-full max-w-full"
      />
    </div>
  );
}

interface ScreenshotDeviceFrameProps {
  screenshot: CapturedScreenshot;
  device: "desktop" | "mobile";
  className?: string;
  frameClassName?: string;
  mobileFrameRef?: React.Ref<SegmentedScrollHandle>;
  desktopFrameRef?: React.Ref<SegmentedScrollHandle>;
}

export function ScreenshotDeviceFrame({
  screenshot,
  device,
  className,
  frameClassName,
  mobileFrameRef,
  desktopFrameRef,
}: ScreenshotDeviceFrameProps) {
  const isMobile = device === "mobile";
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const desktopSegmentRefs = useRef<Map<number, HTMLElement>>(new Map());
  const mobileSegmentRefs = useRef<Map<number, HTMLElement>>(new Map());

  useImperativeHandle(
    desktopFrameRef,
    () => createScrollHandle(desktopScrollRef, desktopSegmentRefs),
    []
  );

  if (isMobile) {
    return (
      <div className={className}>
        <ScaledMobileDeviceFrame
          screenshot={screenshot}
          className={frameClassName}
          mobileFrameRef={mobileFrameRef}
          segmentRefs={mobileSegmentRefs}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <DesktopDeviceFrame
        screenshot={screenshot}
        variant="scrollable"
        frameClassName={frameClassName}
        segmentRefs={desktopSegmentRefs}
        scrollRef={desktopScrollRef}
      />
    </div>
  );
}

interface ScreenshotZoomDialogProps {
  open: boolean;
  onClose: () => void;
  screenshot: CapturedScreenshot;
  device: "desktop" | "mobile";
  title: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function ScreenshotZoomDialog({
  open,
  onClose,
  screenshot,
  device,
  title,
  returnFocusRef,
}: ScreenshotZoomDialogProps) {
  const [mode, setMode] = useState<PreviewMode>("device");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const mobileFrameRef = useRef<SegmentedScrollHandle>(null);
  const isMobile = device === "mobile";
  const label = device === "desktop" ? "Desktop Screenshot" : "Mobile Screenshot";

  useBodyScrollLock(open);

  useEffect(() => {
    if (open) {
      setMode("device");
      closeButtonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  function handleClose() {
    onClose();
    requestAnimationFrame(() => returnFocusRef?.current?.focus());
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface shadow-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex-shrink-0 border-b border-border px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p id={titleId} className="text-sm font-semibold text-ink">
                    {label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{title}</p>
                  {isMobile ? (
                    <p className="mt-1 font-mono text-[10px] text-ink-faint">
                      {screenshot.viewportWidth}×{screenshot.viewportHeight}
                    </p>
                  ) : null}
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={handleClose}
                  aria-label="확대 보기 닫기"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-border text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
                    <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div role="tablist" aria-label="확대 보기 모드" className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    { id: "device" as const, label: "기기 크기" },
                    { id: "full" as const, label: "전체 페이지" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={mode === tab.id}
                    onClick={() => setMode(tab.id)}
                    className={cn(
                      "min-h-11 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
                      mode === tab.id
                        ? "border-ink bg-ink text-white"
                        : "border-border bg-surface text-ink-muted hover:bg-surface-alt"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={cn(
                "flex min-h-0 flex-1 justify-center p-5",
                mode === "full" ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
              )}
            >
              {mode === "device" ? (
                isMobile ? (
                  <ScaledMobileDeviceFrame
                    screenshot={screenshot}
                    className="h-full min-h-[280px] max-h-full"
                    maxAvailableHeight={560}
                    mobileFrameRef={mobileFrameRef}
                  />
                ) : (
                  <DesktopDeviceFrame screenshot={screenshot} variant="scrollable" />
                )
              ) : (
                <FullPagePreview screenshot={screenshot} title={title} label={label} />
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export type { SegmentDisplayItem };
