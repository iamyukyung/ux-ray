import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink"
          aria-label="UX-Ray 홈"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-ink font-mono text-xs text-white"
          >
            UX
          </span>
          <span aria-hidden="true">Ray</span>
        </Link>
        <nav aria-label="주요 링크" className="flex items-center gap-4 text-sm text-ink-muted">
          <a href="#evaluation-areas" className="hidden hover:text-ink sm:inline">
            평가 영역
          </a>
          <Link href="/" className="hover:text-ink">
            새 리뷰 시작
          </Link>
        </nav>
      </div>
    </header>
  );
}
