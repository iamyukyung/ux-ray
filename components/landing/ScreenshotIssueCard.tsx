"use client";

import { useState } from "react";
import { ScreenshotGenerateFixDrawer } from "@/components/landing/ScreenshotGenerateFixDrawer";
import { Button } from "@/components/ui/Button";
import { formatScreenReferenceLabel } from "@/lib/screenshot-report-utils";
import {
  ANALYSIS_CONFIDENCE_LABELS,
  SCREENSHOT_ISSUE_CATEGORY_META,
  SCREENSHOT_ISSUE_SEVERITY_META,
  type ScreenCropMetadata,
  type ScreenshotReviewIssue,
  type ScreenshotReviewReport,
  type ScreenshotVisualEvidence,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScreenshotIssueCardProps {
  issue: ScreenshotReviewIssue;
  report: ScreenshotReviewReport;
  index: number;
  onScreenReferenceClick: (screenId: string) => void;
  onEvidenceClick?: (evidence: ScreenshotVisualEvidence) => void;
}

function isVisualEvidence(
  item: ScreenshotReviewIssue["evidence"][number]
): item is ScreenshotVisualEvidence {
  return typeof item === "object" && item !== null && "observation" in item;
}

export function ScreenshotIssueCard({
  issue,
  report,
  index,
  onScreenReferenceClick,
  onEvidenceClick,
}: ScreenshotIssueCardProps) {
  const [fixOpen, setFixOpen] = useState(false);
  const severity = SCREENSHOT_ISSUE_SEVERITY_META[issue.severity];
  const category = SCREENSHOT_ISSUE_CATEGORY_META[issue.category];

  return (
    <>
      <li className="rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-ink-faint">
            #{String(index + 1).padStart(2, "0")}
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-surface-alt px-2.5 py-1 text-xs font-medium text-ink-muted">
            {category.label}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
              issue.severity === "high" && "bg-high-soft text-high",
              issue.severity === "medium" && "bg-medium-soft text-medium",
              issue.severity === "low" && "bg-low-soft text-low"
            )}
          >
            {severity.fieldLabel}: {severity.label}
          </span>
        </div>

        <h3 className="mt-4 text-base font-semibold leading-snug text-ink">{issue.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{issue.description}</p>

        {issue.principle ? (
          <div className="mt-4 rounded-lg border border-border bg-surface-alt/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              검수 원칙
            </p>
            <p className="mt-2 inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink">
              {issue.principle.label}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              {issue.principle.rationale}
            </p>
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          <IssueField label="관련 화면">
            <ul className="flex flex-wrap gap-2">
              {issue.screenReferences.map((ref) => (
                <li key={ref.screenId}>
                  <button
                    type="button"
                    onClick={() => onScreenReferenceClick(ref.screenId)}
                    aria-label={`${formatScreenReferenceLabel(ref.order, ref.screenName)} 확대 보기`}
                    className="min-h-11 rounded-md border border-border bg-surface-alt px-3 py-2 text-xs font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {formatScreenReferenceLabel(ref.order, ref.screenName)}
                  </button>
                </li>
              ))}
            </ul>
          </IssueField>

          <IssueField label="화면 근거">
            <ul className="space-y-3">
              {issue.evidence.map((item, evidenceIndex) => {
                if (isVisualEvidence(item)) {
                  const clickable = Boolean(onEvidenceClick);
                  return (
                    <li key={`${item.screenId}-${item.cropId ?? evidenceIndex}`}>
                      <button
                        type="button"
                        disabled={!clickable}
                        onClick={() => onEvidenceClick?.(item)}
                        className={cn(
                          "w-full rounded-lg border border-border bg-surface-alt/60 p-4 text-left",
                          clickable &&
                            "hover:border-accent/40 hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        )}
                      >
                        <p className="text-xs font-medium text-ink-muted">
                          {item.screenName}
                          {item.locationLabel ? ` · ${item.locationLabel}` : null}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-ink">{item.observation}</p>
                        <p className="mt-2 text-xs text-ink-muted">
                          분석 확신도: {ANALYSIS_CONFIDENCE_LABELS[item.confidence]}
                        </p>
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-faint" />
                    <span>{item}</span>
                  </li>
                );
              })}
            </ul>
          </IssueField>

          <IssueField label="예상 영향">
            <p className="text-sm leading-relaxed text-ink-muted">{issue.expectedImpact}</p>
          </IssueField>

          <IssueField label="개선안">
            <p className="text-sm leading-relaxed text-ink">{issue.recommendation}</p>
          </IssueField>

          {issue.validationMethod ? (
            <IssueField label="개선 후 확인 방법">
              <p className="text-sm leading-relaxed text-ink-muted">{issue.validationMethod}</p>
            </IssueField>
          ) : null}
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <Button variant="secondary" size="md" className="min-h-11" onClick={() => setFixOpen(true)}>
            Generate Fix
          </Button>
        </div>
      </li>

      <ScreenshotGenerateFixDrawer
        issue={issue}
        report={report}
        open={fixOpen}
        onClose={() => setFixOpen(false)}
      />
    </>
  );
}

function IssueField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export type { ScreenCropMetadata };
