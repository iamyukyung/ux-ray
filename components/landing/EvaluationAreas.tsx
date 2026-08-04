import { CATEGORY_META, MOBILE_CATEGORY_ORDER, type Category } from "@/lib/types";

const ICONS: Record<Category, JSX.Element> = {
  purpose: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
    </>
  ),
  structure: (
    <>
      <rect x="4" y="4" width="16" height="4.2" rx="1" />
      <rect x="4" y="10" width="10" height="4.2" rx="1" />
      <rect x="4" y="16" width="13" height="4.2" rx="1" />
    </>
  ),
  cta: <path d="M6 4l11 6.5-4.6 1.6L11 17z" />,
  readability: (
    <>
      <line x1="5" y1="6" x2="19" y2="6" />
      <line x1="5" y1="11" x2="19" y2="11" />
      <line x1="5" y1="16" x2="13" y2="16" />
    </>
  ),
  trust: (
    <>
      <path d="M12 3l7 3v5c0 5-3.2 8-7 10-3.8-2-7-5-7-10V6z" />
      <path d="M9.2 12l2 2 4-4" />
    </>
  ),
  accessibility: (
    <>
      <circle cx="12" cy="5.5" r="1.6" />
      <path d="M5 9h14" />
      <path d="M12 9v11" />
      <path d="M8 20l4-6 4 6" />
      <path d="M8.5 12.5h7" />
    </>
  ),
  mobileUsability: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" strokeLinecap="round" />
    </>
  ),
};

export function EvaluationAreas() {
  return (
    <section id="evaluation-areas" className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h2 className="text-xl font-semibold text-ink">7가지 영역을 진단합니다</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
        UX-Ray는 데스크톱(1440×900)과 모바일(390×844)을 각각 분석해 공통 6개 영역과 모바일
        전용 영역까지 함께 점검합니다.
      </p>
      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOBILE_CATEGORY_ORDER.map((categoryId) => {
          const meta = CATEGORY_META[categoryId];
          const isMobileOnly = categoryId === "mobileUsability";
          return (
            <li
              key={categoryId}
              className="rounded-lg border border-border bg-surface p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-accent"
                  aria-hidden="true"
                >
                  {ICONS[categoryId]}
                </svg>
                {isMobileOnly ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong">
                    모바일 전용
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 text-[15px] font-semibold text-ink">{meta.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{meta.description}</p>
              {meta.aspects ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {meta.aspects.map((aspect) => (
                    <li
                      key={aspect}
                      className="rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-muted"
                    >
                      {aspect}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
