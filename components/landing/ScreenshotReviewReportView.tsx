"use client";

import { useState } from "react";
import { ScreenshotIssueCard } from "@/components/landing/ScreenshotIssueCard";
import { ScreenshotReviewScreensSection } from "@/components/landing/ScreenshotReviewScreensSection";
import type { ZoomCropHighlight } from "@/components/landing/UploadedImageZoomModal";
import { AiInsightCard } from "@/components/report/AiInsightCard";
import { InsightReasoningAccordion } from "@/components/report/InsightReasoningAccordion";
import { Button } from "@/components/ui/Button";
import { screenshotInsightToAiInsight } from "@/lib/screenshot-report-utils";
import { formatScreenReferenceLabel } from "@/lib/screenshot-report-utils";
import { getReviewModeLabel } from "@/lib/screenshot-review-utils";
import {
  ANALYSIS_CONFIDENCE_LABELS,
  type ScreenshotReviewDebugInfo,
  type ScreenshotReviewReport,
  type ScreenshotVisualEvidence,
  type UploadedScreen,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScreenshotReviewReportViewProps {
  report: ScreenshotReviewReport;
  debug?: ScreenshotReviewDebugInfo | null;
  screens: UploadedScreen[];
  onEditInput: () => void;
  onStartNewReview: () => void;
  onZoom: (screen: UploadedScreen, cropHighlight?: ZoomCropHighlight | null) => void;
}

export function ScreenshotReviewReportView({
  report,
  debug,
  screens,
  onEditInput,
  onStartNewReview,
  onZoom,
}: ScreenshotReviewReportViewProps) {
  const [highlightedScreenId, setHighlightedScreenId] = useState<string | null>(null);
  const aiInsight = screenshotInsightToAiInsight(report.insight);
  const hasContext = Boolean(report.userGoal || report.targetUser || report.focusArea);
  const isAiReport = report.analysisType === "ai";
  const strengths = report.strengths ?? [];
  const limitations = report.limitations ?? [];

  function handleScreenReferenceClick(screenId: string) {
    setHighlightedScreenId(screenId);
    const screen = screens.find((item) => item.id === screenId);
    if (screen) onZoom(screen);
  }

  function handleEvidenceClick(evidence: ScreenshotVisualEvidence) {
    const screen = screens.find((item) => item.id === evidence.screenId);
    if (!screen) return;

    const crop =
      evidence.cropId && report.cropMetadata
        ? report.cropMetadata.find((item) => item.cropId === evidence.cropId)
        : undefined;

    onZoom(screen, crop ? { crop } : null);
  }

  return (
    <div className="space-y-6">
      {process.env.NODE_ENV === "development" && debug ? (
        <p className="rounded-md border border-border bg-surface-alt px-3 py-2 font-mono text-xs text-ink-muted">
          Source: {debug.source} · Request ID: {debug.requestId}
          {debug.pipelineVersion ? ` · Pipeline: ${debug.pipelineVersion}` : null}
          {debug.diagnostics
            ? ` · Crops: ${debug.diagnostics.cropCount} · Rewritten: ${debug.diagnostics.wasRewritten ? "yes" : "no"} · Quality: ${debug.diagnostics.qualityScores.specificity}/${debug.diagnostics.qualityScores.evidenceQuality}/${debug.diagnostics.qualityScores.nonHallucination}`
            : null}
          {" · "}AI issues: {debug.aiIssueCount} · Rendered: {debug.renderedIssueCount}
        </p>
      ) : null}

      <section
        aria-labelledby="review-banner-heading"
        className={cn(
          "rounded-xl border p-5 sm:p-6",
          isAiReport ? "border-positive/30 bg-positive/5" : "border-accent/30 bg-accent/5"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="review-banner-heading" className="text-lg font-semibold text-ink">
              {isAiReport ? "AI 이미지 분석" : "이미지 기반 Mock 리뷰"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {isAiReport
                ? "업로드된 화면과 입력한 리뷰 맥락을 기반으로 분석했습니다."
                : "현재 리포트는 화면 정보와 입력한 맥락을 기반으로 생성된 예시입니다. 실제 이미지 내용을 AI가 분석한 결과는 아닙니다."}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold",
              isAiReport
                ? "border-positive/40 bg-surface text-positive"
                : "border-accent/40 bg-surface text-accent"
            )}
          >
            {isAiReport ? "AI 이미지 분석" : "Mock 리뷰"}
          </span>
        </div>
      </section>

      <header className="rounded-xl border border-border bg-surface p-6 shadow-panel sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">리뷰 대상</p>
            <h1 className="mt-1 break-words text-2xl font-semibold text-ink">{report.projectName}</h1>
            <dl className="mt-4 grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide">리뷰 유형</dt>
                <dd className="mt-0.5 text-ink">
                  {getReviewModeLabel(report.reviewMode, report.screenCount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide">화면 수</dt>
                <dd className="mt-0.5 text-ink">{report.screenCount}개</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide">기기 유형</dt>
                <dd className="mt-0.5 text-ink">{report.deviceSummary}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide">생성 시각</dt>
                <dd className="mt-0.5 font-mono text-ink">
                  {new Date(report.createdAt).toLocaleString("ko-KR")}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button type="button" variant="secondary" className="min-h-11" onClick={onEditInput}>
              입력 내용 수정
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onStartNewReview}>
              새로운 리뷰 시작
            </Button>
          </div>
        </div>
      </header>

      {hasContext ? (
        <section aria-labelledby="report-context-heading" className="rounded-xl border border-border bg-surface-alt/40 p-5 sm:p-6">
          <h2 id="report-context-heading" className="text-base font-semibold text-ink">
            리뷰 맥락
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            {report.userGoal ? (
              <div>
                <dt className="font-medium text-ink-muted">사용자 목표</dt>
                <dd className="mt-1 text-ink">{report.userGoal}</dd>
              </div>
            ) : null}
            {report.targetUser ? (
              <div>
                <dt className="font-medium text-ink-muted">주요 사용자</dt>
                <dd className="mt-1 text-ink">{report.targetUser}</dd>
              </div>
            ) : null}
            {report.focusArea ? (
              <div>
                <dt className="font-medium text-ink-muted">집중 검토 영역</dt>
                <dd className="mt-1 text-ink">{report.focusArea}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {report.pageSummary ? (
        <section
          aria-labelledby="page-understanding-heading"
          className="rounded-xl border border-border bg-surface p-5 sm:p-6"
        >
          <h2 id="page-understanding-heading" className="text-base font-semibold text-ink">
            페이지 이해
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-ink-muted">추론한 페이지 목적</dt>
              <dd className="mt-1 leading-relaxed text-ink">{report.pageSummary.probablePurpose}</dd>
            </div>
            {report.pageSummary.primaryAudiences.length > 0 ? (
              <div>
                <dt className="font-medium text-ink-muted">주요 방문자 또는 사용자</dt>
                <dd className="mt-1 text-ink">{report.pageSummary.primaryAudiences.join(", ")}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-ink-muted">페이지 콘텐츠 흐름</dt>
              <dd className="mt-1 leading-relaxed text-ink">{report.pageSummary.contentNarrative}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {report.pageSummary && report.pageSummary.assumptions.length > 0 ? (
        <section
          aria-labelledby="inferred-context-heading"
          className="rounded-xl border border-border bg-surface-alt/40 p-5 sm:p-6"
        >
          <h2 id="inferred-context-heading" className="text-base font-semibold text-ink">
            AI가 추론한 검토 맥락
          </h2>
          <ul className="mt-4 space-y-4">
            {report.pageSummary.assumptions.map((assumption) => (
              <li
                key={assumption.statement}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <p className="text-sm leading-relaxed text-ink">{assumption.statement}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  근거: {assumption.basis}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  분석 확신도: {ANALYSIS_CONFIDENCE_LABELS[assumption.confidence]}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.executiveSummary ? (
        <section
          aria-labelledby="executive-summary-heading"
          className="rounded-xl border border-border bg-surface p-5 sm:p-6"
        >
          <h2 id="executive-summary-heading" className="text-base font-semibold text-ink">
            종합 요약
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink">{report.executiveSummary}</p>
        </section>
      ) : null}

      <AiInsightCard insight={aiInsight} />
      <InsightReasoningAccordion evidence={aiInsight.evidence} />

      {strengths.length > 0 ? (
        <section aria-labelledby="screenshot-strengths-heading">
          <h2 id="screenshot-strengths-heading" className="mb-4 text-lg font-semibold text-ink">
            잘된 점
          </h2>
          <ul className="space-y-4">
            {strengths.map((strength) => (
              <li
                key={strength.title}
                className="rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6"
              >
                <h3 className="text-base font-semibold text-ink">{strength.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{strength.description}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {strength.screenReferences.map((ref) => (
                    <li key={ref.screenId}>
                      <button
                        type="button"
                        onClick={() => handleScreenReferenceClick(ref.screenId)}
                        aria-label={`${formatScreenReferenceLabel(ref.order, ref.screenName)} 확대 보기`}
                        className="min-h-11 rounded-md border border-border bg-surface-alt px-3 py-2 text-xs font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {formatScreenReferenceLabel(ref.order, ref.screenName)}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ScreenshotReviewScreensSection
        screens={screens}
        reviewMode={report.reviewMode}
        onZoom={onZoom}
        highlightedScreenId={highlightedScreenId}
      />

      <section aria-labelledby="screenshot-issues-heading">
        <h2 id="screenshot-issues-heading" className="mb-4 text-lg font-semibold text-ink">
          개선 이슈
        </h2>
        <ul className="space-y-4">
          {report.issues.map((issue, index) => (
            <ScreenshotIssueCard
              key={`${report.createdAt}-${issue.id}-${index}`}
              issue={issue}
              report={report}
              index={index}
              onScreenReferenceClick={handleScreenReferenceClick}
              onEvidenceClick={handleEvidenceClick}
            />
          ))}
        </ul>
      </section>

      {limitations.length > 0 ? (
        <section
          aria-labelledby="screenshot-limitations-heading"
          className="rounded-xl border border-border bg-surface-alt/40 p-5 sm:p-6"
        >
          <h2 id="screenshot-limitations-heading" className="text-base font-semibold text-ink">
            분석 시 참고사항
          </h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-muted">
            {limitations.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-faint" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
