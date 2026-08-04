"use client";

import { useState } from "react";
import { countScreensByDevice, sortScreensByOrder } from "@/lib/screenshot-review-utils";
import { SCREEN_DEVICE_LABELS, type ScreenshotReviewContext } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScreenshotReportSectionProps {
  context: ScreenshotReviewContext;
}

export function ScreenshotReportSection({ context }: ScreenshotReportSectionProps) {
  const sortedScreens = sortScreensByOrder(context.screens);
  const [selectedId, setSelectedId] = useState(sortedScreens[0]?.id ?? "");
  const deviceCounts = countScreensByDevice(context);

  const selectedScreen =
    sortedScreens.find((screen) => screen.id === selectedId) ?? sortedScreens[0];

  if (!selectedScreen) {
    return null;
  }

  return (
    <section
      aria-labelledby="screenshot-report-heading"
      className="rounded-xl border border-border bg-surface p-6 shadow-panel sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="screenshot-report-heading" className="text-lg font-semibold text-ink">
            업로드한 화면
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            화면 이미지 기반으로 수집된 화면입니다.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-border bg-surface-alt px-3 py-1 text-xs font-medium text-ink-muted">
          화면 이미지 기반
        </span>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">분석 방식</dt>
          <dd className="mt-1 text-sm text-ink">화면 이미지 기반</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">업로드 화면</dt>
          <dd className="mt-1 text-sm text-ink">{sortedScreens.length}개</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            리뷰 대상 / 기능명
          </dt>
          <dd className="mt-1 text-sm text-ink">{context.projectName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">기기별 화면</dt>
          <dd className="mt-1 text-sm text-ink">
            Desktop {deviceCounts.desktop} · Mobile {deviceCounts.mobile}
            {deviceCounts.tablet + deviceCounts.custom > 0
              ? ` · 기타 ${deviceCounts.tablet + deviceCounts.custom}`
              : ""}
          </dd>
        </div>
      </dl>

      {(context.userGoal || context.targetUser || context.focusArea) && (
        <dl className="mt-4 grid gap-3 rounded-lg border border-border bg-surface-alt/50 p-4 sm:grid-cols-3">
          {context.userGoal ? (
            <div>
              <dt className="text-xs font-medium text-ink-muted">사용자 목표</dt>
              <dd className="mt-1 text-sm text-ink">{context.userGoal}</dd>
            </div>
          ) : null}
          {context.targetUser ? (
            <div>
              <dt className="text-xs font-medium text-ink-muted">주요 사용자</dt>
              <dd className="mt-1 text-sm text-ink">{context.targetUser}</dd>
            </div>
          ) : null}
          {context.focusArea ? (
            <div>
              <dt className="text-xs font-medium text-ink-muted">검토 요청</dt>
              <dd className="mt-1 text-sm text-ink">{context.focusArea}</dd>
            </div>
          ) : null}
        </dl>
      )}

      <div
        role="tablist"
        aria-label="업로드한 화면 선택"
        className="mt-6 flex gap-2 overflow-x-auto pb-2"
      >
        {sortedScreens.map((screen) => (
          <button
            key={screen.id}
            type="button"
            role="tab"
            aria-selected={selectedId === screen.id}
            onClick={() => setSelectedId(screen.id)}
            className={cn(
              "flex w-24 flex-shrink-0 flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              selectedId === screen.id
                ? "border-ink ring-2 ring-ink/10"
                : "border-border hover:border-ink/30"
            )}
          >
            <div className="aspect-[9/16] w-full overflow-hidden bg-surface-alt">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screen.previewUrl}
                alt={`${screen.screenName} 썸네일`}
                className="h-full w-full object-cover object-top"
              />
            </div>
            <span className="truncate px-2 py-1.5 text-[11px] font-medium text-ink">
              {screen.screenName}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface-alt/30">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">{selectedScreen.screenName}</p>
            <p className="text-xs text-ink-muted">
              {selectedScreen.width}×{selectedScreen.height} ·{" "}
              {SCREEN_DEVICE_LABELS[selectedScreen.deviceType]}
            </p>
          </div>
          <p className="truncate text-xs text-ink-faint" title={selectedScreen.fileName}>
            {selectedScreen.fileName}
          </p>
        </div>
        <div className="flex justify-center bg-[#111] p-4 sm:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedScreen.previewUrl}
            alt={`${selectedScreen.screenName} 전체 화면`}
            className="max-h-[70vh] w-auto max-w-full rounded-md shadow-panel"
          />
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        이미지 기반 분석은 화면에 보이는 정보와 흐름을 중심으로 진행됩니다. 실제 인터랙션,
        접근성 코드 및 성능은 별도 확인이 필요합니다.
      </p>
    </section>
  );
}
