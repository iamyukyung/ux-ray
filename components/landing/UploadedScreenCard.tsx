"use client";

import { useId, useRef } from "react";
import { Select } from "@/components/ui/Select";
import type { DeviceType, UploadedScreen } from "@/lib/types";
import { SCREEN_DEVICE_OPTIONS } from "@/lib/types";
import { formatFileSize } from "@/lib/upload-validation";
import { cn } from "@/lib/utils";

interface UploadedScreenCardProps {
  screen: UploadedScreen;
  index: number;
  total: number;
  isDragging: boolean;
  isDropTarget: boolean;
  onDelete: (id: string) => void;
  onZoom: (screen: UploadedScreen) => void;
  onScreenNameChange: (id: string, name: string) => void;
  onScreenNameBlur: (id: string) => void;
  onDeviceTypeChange: (id: string, deviceType: DeviceType) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragLeave: () => void;
  onDrop: (id: string) => void;
  onDragEnd: () => void;
}

export function UploadedScreenCard({
  screen,
  index,
  total,
  isDragging,
  isDropTarget,
  onDelete,
  onZoom,
  onScreenNameChange,
  onScreenNameBlur,
  onDeviceTypeChange,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: UploadedScreenCardProps) {
  const screenNameId = useId();
  const deviceTypeId = useId();
  const zoomTriggerRef = useRef<HTMLButtonElement>(null);
  const displayName = screen.screenName.trim() || screen.fileName;

  return (
    <article
      draggable
      onDragStart={() => onDragStart(screen.id)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(screen.id);
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(screen.id);
      }}
      onDragEnd={onDragEnd}
      aria-grabbed={isDragging}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border bg-surface shadow-panel transition-[border-color,box-shadow]",
        isDragging && "border-accent opacity-60",
        isDropTarget && !isDragging && "border-accent ring-2 ring-accent/30",
        !isDragging && !isDropTarget && "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-8 w-8 flex-shrink-0 cursor-grab items-center justify-center rounded-md border border-border bg-surface-alt text-ink-muted active:cursor-grabbing"
            aria-hidden
            title="드래그하여 순서 변경"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <circle cx="5" cy="4" r="1.2" />
              <circle cx="11" cy="4" r="1.2" />
              <circle cx="5" cy="8" r="1.2" />
              <circle cx="11" cy="8" r="1.2" />
              <circle cx="5" cy="12" r="1.2" />
              <circle cx="11" cy="12" r="1.2" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-ink-muted">순서 {index + 1}</span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onMoveUp(screen.id)}
            disabled={index === 0}
            aria-label={`${displayName} 앞으로 이동`}
            className="flex h-11 min-h-11 w-11 items-center justify-center rounded-md border border-border text-ink-muted hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
              <path d="M10 5l-5 5h10l-5-5z" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(screen.id)}
            disabled={index === total - 1}
            aria-label={`${displayName} 뒤로 이동`}
            className="flex h-11 min-h-11 w-11 items-center justify-center rounded-md border border-border text-ink-muted hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
              <path d="M10 15l5-5H5l5 5z" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <button
        ref={zoomTriggerRef}
        type="button"
        onClick={() => onZoom(screen)}
        className="group block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label={`${screen.fileName} 확대 보기`}
      >
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-alt p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screen.previewUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <label htmlFor={screenNameId} className="mb-1.5 block text-xs font-medium text-ink-muted">
            화면 이름
          </label>
          <input
            id={screenNameId}
            type="text"
            value={screen.screenName}
            onChange={(event) => onScreenNameChange(screen.id, event.target.value)}
            onBlur={() => onScreenNameBlur(screen.id)}
            className="w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>

        <div>
          <label htmlFor={deviceTypeId} className="mb-1.5 block text-xs font-medium text-ink-muted">
            기기 유형
          </label>
          <Select
            id={deviceTypeId}
            className="min-w-0"
            value={screen.deviceType}
            onChange={(event) =>
              onDeviceTypeChange(screen.id, event.target.value as DeviceType)
            }
          >
            {SCREEN_DEVICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <p className="truncate text-xs text-ink-muted" title={screen.fileName}>
          {screen.fileName}
        </p>

        <dl className="space-y-1 text-xs text-ink-muted">
          <div className="flex justify-between gap-2">
            <dt>해상도</dt>
            <dd className="font-mono text-ink">
              {screen.width}×{screen.height}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>용량</dt>
            <dd className="font-mono text-ink">{formatFileSize(screen.fileSize)}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => onDelete(screen.id)}
          aria-label={`${displayName} 삭제`}
          className="mt-auto min-h-11 rounded-md border border-critical/30 px-3 text-xs font-medium text-critical hover:bg-critical/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          삭제
        </button>
      </div>
    </article>
  );
}

export function ScreenFlowArrow() {
  return (
    <div className="flex justify-center py-1 text-ink-faint" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M12 5v14M7 14l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
