"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { looksLikeUrl, normalizeUrl } from "@/lib/utils";
import { resolveMockReviewId } from "@/lib/mock-review";

export function UrlForm() {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!value.trim()) {
      setError("분석할 웹사이트 URL을 입력해주세요.");
      return;
    }

    if (!looksLikeUrl(value)) {
      setError("올바른 URL을 입력해주세요.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const normalized = normalizeUrl(value);
    const reviewId = resolveMockReviewId(normalized);
    router.push(`/review/${reviewId}?url=${encodeURIComponent(normalized)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl" noValidate>
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-ink">
        분석할 웹사이트 URL
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <input
            id={inputId}
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="example.com 또는 https://example.com"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="h-12 w-full rounded-md border border-border bg-surface px-4 text-[15px] text-ink placeholder:text-ink-faint focus-visible:border-accent"
          />
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting} className="sm:w-auto">
          {isSubmitting ? "이동 중…" : "UX 리뷰 시작하기"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        로그인 없이 무료로 진단합니다. 공개된 페이지만 분석할 수 있어요.
      </p>
      <div aria-live="polite">
        {error ? (
          <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-critical">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
