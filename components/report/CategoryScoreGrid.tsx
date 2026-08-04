import { CATEGORY_META, type CategoryScore } from "@/lib/types";
import { scoreTone } from "@/lib/utils";

const TONE_BAR_CLASS: Record<ReturnType<typeof scoreTone>, string> = {
  positive: "bg-positive",
  medium: "bg-medium",
  critical: "bg-critical",
};

export function CategoryScoreGrid({ scores }: { scores: CategoryScore[] }) {
  return (
    <section aria-labelledby="category-scores-heading">
      <h2 id="category-scores-heading" className="text-lg font-semibold text-ink">
        영역별 점수
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {scores.map(({ category, score, note }) => {
          const meta = CATEGORY_META[category];
          const tone = scoreTone(score);
          return (
            <li
              key={category}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-ink">{meta.label}</span>
                <span className="font-mono text-sm font-semibold text-ink">
                  {score}
                  <span className="text-ink-faint">/100</span>
                </span>
              </div>
              <div
                className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt"
                role="progressbar"
                aria-label={`${meta.label} 점수`}
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full ${TONE_BAR_CLASS[tone]}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-ink-muted">{note}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
