import { ScoreGauge } from "@/components/ui/ScoreGauge";

export function ScoreCard({
  title,
  caption,
  score,
}: {
  title: string;
  caption?: string;
  score: number;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-surface p-5">
      {caption ? <p className="font-mono text-xs text-ink-muted">{caption}</p> : null}
      <div className="mt-2">
        <ScoreGauge score={score} label={title} size={168} />
      </div>
    </div>
  );
}
