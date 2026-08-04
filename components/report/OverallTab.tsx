import { AiInsightCard } from "@/components/report/AiInsightCard";
import { InsightReasoningAccordion } from "@/components/report/InsightReasoningAccordion";
import { ScoreSummaryRow } from "@/components/report/ScoreSummaryRow";
import { IssueCard } from "@/components/report/IssueCard";
import { resolveAiInsight } from "@/lib/ai-insight";
import { SEVERITY_META, type ReviewReport } from "@/lib/types";

const TOP_ISSUES_LIMIT = 5;

export function OverallTab({ report }: { report: ReviewReport }) {
  const aiInsight = resolveAiInsight(report);

  const topIssues = [...report.issues]
    .sort((a, b) => SEVERITY_META[b.severity].weight - SEVERITY_META[a.severity].weight)
    .slice(0, TOP_ISSUES_LIMIT);

  return (
    <div className="space-y-10">
      <AiInsightCard insight={aiInsight} />

      {aiInsight.evidence.length > 0 ? (
        <InsightReasoningAccordion evidence={aiInsight.evidence} />
      ) : null}

      <ScoreSummaryRow report={report} />

      <section aria-labelledby="top-issues-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="top-issues-heading" className="text-lg font-semibold text-ink">
            Top Issues
          </h2>
          <p className="text-sm text-ink-muted">심각도 기준 상위 {topIssues.length}건</p>
        </div>

        <ul className="mt-6 space-y-6">
          {topIssues.map((issue, index) => (
            <IssueCard key={issue.id} issue={issue} index={index} />
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="difference-summary-heading"
        className="rounded-xl border border-border bg-surface-alt/60 p-6 sm:p-8"
      >
        <h2 id="difference-summary-heading" className="text-sm font-semibold text-ink">
          데스크톱 · 모바일 차이 요약
        </h2>
        <p className="mt-3 text-sm leading-[1.7] text-ink-muted">{report.differenceSummary}</p>
      </section>
    </div>
  );
}
