"use client";

import { useEffect, useRef, useState } from "react";
import type { Device } from "@/lib/types";

interface DeviceScreenshotProps {
  device: Device;
  label: string;
  viewport: string;
}

/**
 * 실제 캡처 이미지 대신, 기기 프레임에 담긴 와이어프레임 목업을 보여줍니다.
 * 확대 버튼을 누르면 같은 목업을 더 큰 다이얼로그로 띄워 "스크린샷 확대 보기"를 시연합니다.
 */
export function DeviceScreenshot({ device, label, viewport }: DeviceScreenshotProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isZoomed) {
      closeButtonRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [isZoomed]);

  useEffect(() => {
    if (!isZoomed) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsZoomed(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isZoomed]);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="font-mono text-xs text-ink-muted">{viewport}</p>
        </div>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsZoomed(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-alt"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M17 17l-3.8-3.8M8.5 6v5M6 8.5h5" />
          </svg>
          확대 보기
        </button>
      </div>

      <div className="mt-4 flex justify-center">
        <Wireframe device={device} scale="thumb" />
      </div>

      {isZoomed ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} 확대 보기`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsZoomed(false);
          }}
        >
          <div className="max-h-full w-full max-w-lg overflow-auto rounded-xl bg-surface p-5 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="font-mono text-xs text-ink-muted">{viewport}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setIsZoomed(false)}
                aria-label="확대 보기 닫기"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-alt"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="mt-4 flex justify-center">
              <Wireframe device={device} scale="full" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Wireframe({ device, scale }: { device: Device; scale: "thumb" | "full" }) {
  const isDesktop = device === "desktop";
  const frameClass = isDesktop
    ? scale === "thumb"
      ? "h-32 w-full max-w-xs"
      : "h-72 w-full max-w-2xl"
    : scale === "thumb"
    ? "h-40 w-24"
    : "h-[28rem] w-64";

  return (
    <div
      aria-hidden="true"
      className={`${frameClass} overflow-hidden rounded-md border border-border bg-surface-alt p-2.5`}
    >
      <div className="flex h-full flex-col gap-1.5">
        <div className="h-2.5 w-2/5 rounded-sm bg-border" />
        <div className={isDesktop ? "h-8 w-full rounded-sm bg-border" : "h-10 w-full rounded-sm bg-border"} />
        <div className={isDesktop ? "grid flex-1 grid-cols-3 gap-1.5" : "flex flex-1 flex-col gap-1.5"}>
          {Array.from({ length: isDesktop ? 3 : 4 }, (_, i) => (
            <div key={i} className="rounded-sm bg-border/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
