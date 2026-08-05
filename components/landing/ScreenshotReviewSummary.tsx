"use client";

import { useId } from "react";
import {
  countScreensByDevice,
  getReviewModeLabel,
  sortScreensByOrder,
} from "@/lib/screenshot-review-utils";
import {
  REVIEW_LENS_META,
  SCREEN_DEVICE_LABELS,
  type ScreenshotReviewContext,
} from "@/lib/types";

interface ScreenshotReviewSummaryProps {
  context: ScreenshotReviewContext;
}

export function ScreenshotReviewSummary({ context }: ScreenshotReviewSummaryProps) {
  const headingId = useId();
  const sortedScreens = sortScreensByOrder(context.screens);
  const deviceCounts = countScreensByDevice(context);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-surface-alt/40 p-5 sm:p-6"
    >
      <h3 id={headingId} className="text-base font-semibold text-ink">
        리뷰 내용 요약
      </h3>

      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            리뷰 유형
          </dt>
          <dd className="mt-1 text-sm text-ink">
            {getReviewModeLabel(context.screenLayoutMode, sortedScreens.length)}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            화면 수
          </dt>
          <dd className="mt-1 text-sm text-ink">{sortedScreens.length}개</dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            화면 순서와 이름
          </dt>
          <dd className="mt-2">
            <ol className="space-y-1.5">
              {sortedScreens.map((screen, index) => (
                <li
                  key={screen.id}
                  className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink"
                >
                  <span className="font-mono text-xs text-ink-muted">{index + 1}.</span>
                  <span className="min-w-0 break-words">{screen.screenName}</span>
                  <span className="text-xs text-ink-muted">
                    ({SCREEN_DEVICE_LABELS[screen.deviceType]})
                  </span>
                </li>
              ))}
            </ol>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            기기 유형별 개수
          </dt>
          <dd className="mt-1 text-sm text-ink">
            데스크톱 {deviceCounts.desktop} · 모바일 {deviceCounts.mobile} · 태블릿{" "}
            {deviceCounts.tablet} · 직접 지정 {deviceCounts.custom}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            검수 기준
          </dt>
          <dd className="mt-1 text-sm text-ink">
            {REVIEW_LENS_META[context.reviewLens ?? "general"].inputLabel}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            리뷰 맥락
          </dt>
          <dd className="mt-2 space-y-2 text-sm text-ink">
            <p>
              <span className="font-medium text-ink-muted">리뷰 대상: </span>
              {context.projectName ?? "—"}
            </p>
            <p>
              <span className="font-medium text-ink-muted">사용자 목표: </span>
              {context.userGoal ?? "—"}
            </p>
            <p>
              <span className="font-medium text-ink-muted">주요 사용자: </span>
              {context.targetUser ?? "—"}
            </p>
            <p>
              <span className="font-medium text-ink-muted">검토 요청: </span>
              {context.focusArea ?? "—"}
            </p>
          </dd>
        </div>
      </dl>
    </section>
  );
}
