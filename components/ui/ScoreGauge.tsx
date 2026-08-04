import { scoreTone } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  label?: string;
  size?: number;
}

const TONE_COLOR: Record<ReturnType<typeof scoreTone>, string> = {
  positive: "rgb(var(--color-positive))",
  medium: "rgb(var(--color-medium))",
  critical: "rgb(var(--color-critical))",
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
}

/**
 * 반원형 계측기 다이얼 — 진단 리포트라는 제품 정체성을 드러내는 시그니처 요소.
 * 눈금(tick)은 10점 단위로 표시되어 계측 도구의 느낌을 줍니다.
 */
export function ScoreGauge({ score, label = "종합 점수", size = 200 }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone = scoreTone(clamped);
  const cx = 100;
  const cy = 104;
  const r = 82;
  const fraction = clamped / 100;
  const endAngle = 180 - fraction * 180;

  const trackPath = describeArc(cx, cy, r, 180, 0);
  const valuePath = describeArc(cx, cy, r, 180, endAngle);

  const ticks = Array.from({ length: 11 }, (_, i) => 180 - i * 18).map((angle) => {
    const outer = polarToCartesian(cx, cy, r + 9, angle);
    const inner = polarToCartesian(cx, cy, r + 1, angle);
    return { angle, outer, inner };
  });

  return (
    <div
      className="relative"
      style={{ width: size, height: size * 0.62 }}
      role="img"
      aria-label={`${label} ${clamped}점 (100점 만점)`}
    >
      <svg viewBox="0 0 200 124" className="h-full w-full" aria-hidden="true">
        {ticks.map((tick) => (
          <line
            key={tick.angle}
            x1={tick.inner.x}
            y1={tick.inner.y}
            x2={tick.outer.x}
            y2={tick.outer.y}
            stroke="rgb(var(--color-border))"
            strokeWidth={1.5}
          />
        ))}
        <path
          d={trackPath}
          fill="none"
          stroke="rgb(var(--color-surface-alt))"
          strokeWidth={14}
          strokeLinecap="round"
        />
        <path
          d={valuePath}
          fill="none"
          stroke={TONE_COLOR[tone]}
          strokeWidth={14}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-mono text-4xl font-semibold leading-none text-ink">
          {clamped}
        </span>
        <span className="mt-1 text-xs text-ink-muted">{label} · 100점 만점</span>
      </div>
    </div>
  );
}
