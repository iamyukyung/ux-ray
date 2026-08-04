import Link from "next/link";

export function ReportEmptyState({ reportId }: { reportId: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center sm:px-6">
      <div
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-ink-faint"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4.4-4.4" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="mt-5 text-lg font-semibold text-ink">리포트를 찾을 수 없어요</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        <span className="font-mono">{reportId}</span> 리포트가 만료되었거나 존재하지 않습니다.
        URL을 다시 입력해 새 리포트를 만들어보세요.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong"
      >
        새 리뷰 시작하기
      </Link>
    </div>
  );
}
