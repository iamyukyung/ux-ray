import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function ReportErrorState({
  url,
  message,
  onRetry,
}: {
  url: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center sm:px-6">
      <div
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-critical-soft text-critical"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <path d="M12 9v4M12 16.5v.01" strokeLinecap="round" />
          <path d="M10.3 4.6L2.9 18.2a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.6a1.6 1.6 0 00-2.8 0z" />
        </svg>
      </div>
      <h1 className="mt-5 text-lg font-semibold text-ink">분석에 실패했어요</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        <span className="block font-mono text-xs text-ink-faint">{url}</span>
        <span className="mt-2 block">
          {message ??
            "페이지를 불러오는 중 오류가 발생했습니다. 페이지가 접근 가능한 상태인지 확인한 뒤 다시 시도해주세요."}
        </span>
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="primary" onClick={onRetry}>
          다시 분석하기
        </Button>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-alt"
        >
          다른 URL 입력하기
        </Link>
      </div>
    </div>
  );
}
