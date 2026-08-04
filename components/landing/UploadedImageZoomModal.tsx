"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ScreenCropMetadata, UploadedScreen } from "@/lib/types";
import { cn } from "@/lib/utils";

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

export interface ZoomCropHighlight {
  crop: ScreenCropMetadata;
}

interface UploadedImageZoomModalProps {
  screen: UploadedScreen | null;
  cropHighlight?: ZoomCropHighlight | null;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function UploadedImageZoomModal({
  screen,
  cropHighlight,
  onClose,
  returnFocusRef,
}: UploadedImageZoomModalProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const open = screen !== null;

  useBodyScrollLock(open);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        requestAnimationFrame(() => returnFocusRef?.current?.focus());
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, returnFocusRef]);

  function handleClose() {
    onClose();
    requestAnimationFrame(() => returnFocusRef?.current?.focus());
  }

  if (!screen) return null;

  const imageHeight = cropHighlight?.crop.height
    ? screen.height
    : screen.height;
  const highlightTop =
    cropHighlight && imageHeight > 0
      ? (cropHighlight.crop.yStart / imageHeight) * 100
      : null;
  const highlightHeight =
    cropHighlight && imageHeight > 0
      ? ((cropHighlight.crop.yEnd - cropHighlight.crop.yStart) / imageHeight) * 100
      : null;

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-surface shadow-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p id={titleId} className="truncate text-sm font-semibold text-ink" title={screen.fileName}>
                  {screen.fileName}
                </p>
                <p className="mt-0.5 font-mono text-xs text-ink-muted">
                  {screen.width}×{screen.height}
                  {cropHighlight ? (
                    <span className="ml-2 text-accent">
                      · {cropHighlight.crop.locationLabel} (y {cropHighlight.crop.yStart}–
                      {cropHighlight.crop.yEnd})
                    </span>
                  ) : null}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleClose}
                aria-label="확대 보기 닫기"
                className="flex h-11 min-h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-border text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain p-4 sm:p-6">
              <div className="relative mx-auto w-fit max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screen.previewUrl}
                  alt={`${screen.fileName} 원본`}
                  className="mx-auto block h-auto max-h-[75vh] w-auto max-w-full"
                />
                {highlightTop !== null && highlightHeight !== null ? (
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-x-0 border-2 border-accent bg-accent/10",
                      "ring-2 ring-accent/40"
                    )}
                    style={{
                      top: `${highlightTop}%`,
                      height: `${highlightHeight}%`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
