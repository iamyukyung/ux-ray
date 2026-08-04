export function AnalysisLimitations({ limitations }: { limitations: string[] }) {
  return (
    <section
      aria-labelledby="limitations-heading"
      className="rounded-lg border border-border bg-surface-alt p-5"
    >
      <h2 id="limitations-heading" className="text-sm font-semibold text-ink">
        분석 한계 안내
      </h2>
      <ul className="mt-2.5 space-y-1.5">
        {limitations.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink-muted">
            <span aria-hidden className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-ink-faint" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
