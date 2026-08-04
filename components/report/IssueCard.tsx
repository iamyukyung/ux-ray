"use client";

import { useState } from "react";
import { SeverityBadge, DeviceBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GenerateFixDrawer } from "@/components/report/GenerateFixDrawer";
import type { ReviewIssue } from "@/lib/types";

export function IssueCard({ issue, index }: { issue: ReviewIssue; index: number }) {
  const [fixOpen, setFixOpen] = useState(false);

  return (
    <>
      <li className="rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-ink-faint">
            #{String(index + 1).padStart(2, "0")}
          </span>
          <DeviceBadge device={issue.device} />
        </div>

        <h3 className="mt-4 text-base font-semibold leading-snug text-ink">{issue.title}</h3>
        <p className="mt-1 text-sm text-ink-faint">위치 · {issue.location}</p>

        <div className="mt-6 space-y-5">
          <IssueField label="Severity">
            <SeverityBadge severity={issue.severity} />
          </IssueField>

          <IssueField label="Evidence">
            <p className="text-sm leading-relaxed text-ink">{issue.evidence}</p>
          </IssueField>

          <IssueField label="Expected Impact">
            <p className="text-sm leading-relaxed text-ink-muted">{issue.userImpact}</p>
          </IssueField>

          <IssueField label="Recommendation">
            <p className="text-sm leading-relaxed text-ink">{issue.recommendation}</p>
            {issue.copySuggestion ? (
              <p className="mt-3 rounded-md border border-border bg-surface-alt px-3 py-2.5 text-sm text-ink-muted">
                제안 문구: “{issue.copySuggestion}”
              </p>
            ) : null}
          </IssueField>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <Button variant="secondary" size="md" className="min-h-11" onClick={() => setFixOpen(true)}>
            Generate Fix
          </Button>
        </div>
      </li>

      <GenerateFixDrawer issue={issue} open={fixOpen} onClose={() => setFixOpen(false)} />
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
