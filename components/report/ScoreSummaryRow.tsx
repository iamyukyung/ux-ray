import { scoreTone } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DEVICE_META, type ReviewReport } from "@/lib/types";

function CompactScore({ label, caption, score }: { label: string; caption?: string; score: number }) {
  const tone = scoreTone(score);

  return (
    <div className="text-center">
      {caption ? <p className="font-mono text-[11px] text-ink-faint">{caption}</p> : null}
      <p
        className={cn(
          "mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight",
          tone === "positive" && "text-positive",
          tone === "medium" && "text-medium",
          tone === "critical" && "text-critical"
        )}
      >
        {score}
      </p>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </div>
  );
}

/** 점수는 보조 정보로 — AI Insight 아래에 간결하게 표시 */
export function ScoreSummaryRow({ report }: { report: ReviewReport }) {
  return (
    <section
      aria-labelledby="score-summary-heading"
      className="rounded-xl border border-border bg-surface-alt/60 px-6 py-5 sm:px-8"
    >
      <h2
        id="score-summary-heading"
        className="text-xs font-medium uppercase tracking-wide text-ink-muted"
      >
        점수 요약
      </h2>
      <div className="mt-5 grid grid-cols-3 gap-4 divide-x divide-border sm:gap-6">
        <CompactScore label="Overall Score" score={report.overallScore} />
        <CompactScore
          label="Desktop Score"
          caption={DEVICE_META.desktop.viewport}
          score={report.desktop.score}
        />
        <CompactScore
          label="Mobile Score"
          caption={DEVICE_META.mobile.viewport}
          score={report.mobile.score}
        />
      </div>
    </section>
  );
}
