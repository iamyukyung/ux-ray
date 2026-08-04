import { cn } from "@/lib/utils";
import { DEVICE_META, SEVERITY_META, type IssueDevice, type Severity } from "@/lib/types";

const SEVERITY_CLASSES: Record<Severity, string> = {
  critical: "bg-critical-soft text-critical",
  high: "bg-high-soft text-high",
  medium: "bg-medium-soft text-medium",
  low: "bg-low-soft text-low",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        SEVERITY_CLASSES[severity]
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {SEVERITY_META[severity].label}
    </span>
  );
}

export function CategoryTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-alt px-2.5 py-1 text-xs font-medium text-ink-muted">
      {children}
    </span>
  );
}

const DEVICE_ICON: Record<IssueDevice, JSX.Element> = {
  desktop: (
    <>
      <rect x="2.5" y="4" width="15" height="10" rx="1.2" />
      <path d="M7 17h6M10 14v3" strokeLinecap="round" />
    </>
  ),
  mobile: (
    <>
      <rect x="6" y="2" width="8" height="16" rx="1.6" />
      <path d="M9 15.3h2" strokeLinecap="round" />
    </>
  ),
  both: (
    <>
      <rect x="1.5" y="4.5" width="10.5" height="7.5" rx="1" />
      <path d="M4.5 12v2h4.5" strokeLinecap="round" />
      <rect x="12.5" y="6" width="6" height="11.5" rx="1.3" />
      <path d="M14.7 15.2h1.6" strokeLinecap="round" />
    </>
  ),
};

/** 이슈가 어느 환경(데스크톱/모바일/양쪽)에서 발견됐는지 나타내는 배지 */
export function DeviceBadge({ device }: { device: IssueDevice }) {
  const label = device === "both" ? "데스크톱 · 모바일" : DEVICE_META[device].label;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted">
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        {DEVICE_ICON[device]}
      </svg>
      {label}
    </span>
  );
}
