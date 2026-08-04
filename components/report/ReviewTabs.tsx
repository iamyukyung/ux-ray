export type ReviewTabId = "overall" | "desktop" | "mobile";

interface ReviewTabsProps {
  active: ReviewTabId;
  onChange: (tab: ReviewTabId) => void;
  desktopScore: number;
  mobileScore: number;
}

const TABS: { id: ReviewTabId; label: string }[] = [
  { id: "overall", label: "종합" },
  { id: "desktop", label: "데스크톱" },
  { id: "mobile", label: "모바일" },
];

/** 화면 상단에 고정되는 탭 바 — 모바일에서도 항상 손이 닿는 위치에 유지됩니다. */
export function ReviewTabs({ active, onChange, desktopScore, mobileScore }: ReviewTabsProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
      <div
        role="tablist"
        aria-label="리포트 보기 전환"
        className="mx-auto flex max-w-4xl gap-1 overflow-x-auto"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          const scoreHint =
            tab.id === "desktop" ? desktopScore : tab.id === "mobile" ? mobileScore : null;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`relative flex min-h-11 flex-shrink-0 items-center gap-1.5 px-4 text-sm font-medium transition-colors ${
                isActive ? "text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
              {scoreHint !== null ? (
                <span className="font-mono text-xs text-ink-faint">{scoreHint}</span>
              ) : null}
              {isActive ? (
                <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
