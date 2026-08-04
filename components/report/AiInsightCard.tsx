import type { AiInsight } from "@/lib/types";

export function AiInsightCard({ insight }: { insight: AiInsight }) {
  const paragraphs = insight.summary.split("\n").filter(Boolean);

  return (
    <section
      aria-labelledby="ai-insight-heading"
      className="rounded-xl border border-border bg-surface p-6 shadow-panel sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="ai-insight-heading" className="text-lg font-semibold tracking-tight text-ink">
          🧠 AI Insight
        </h2>
        <span className="flex-shrink-0 rounded-full border border-border bg-surface-alt px-3 py-1 font-mono text-xs font-medium text-ink-muted">
          Confidence {insight.confidence}%
        </span>
      </div>

      <div className="mt-6 space-y-4">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-[15px] leading-[1.7] text-ink">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
