"use client";

import { Button } from "@/components/ui/Button";
import type { ScreenshotReviewClientErrorCode } from "@/lib/api/create-screenshot-review";

interface ScreenshotReviewErrorStateProps {
  code?: ScreenshotReviewClientErrorCode;
  stage?: string;
  onRetry: () => void;
  onBackToEdit: () => void;
}

export function ScreenshotReviewErrorState({
  code,
  stage,
  onRetry,
  onBackToEdit,
}: ScreenshotReviewErrorStateProps) {
  const isTimeout = code === "PIPELINE_TIMEOUT" || code === "AI_TIMEOUT";

  return (
    <section
      aria-labelledby="screenshot-review-error-heading"
      className="rounded-xl border border-border bg-surface p-6 text-center shadow-panel sm:p-8"
    >
      <h2 id="screenshot-review-error-heading" className="text-lg font-semibold text-ink">
        {isTimeout ? "리뷰 생성 시간이 초과됐어요" : "AI 리뷰를 만들지 못했어요"}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        {isTimeout
          ? "화면이 길거나 분석할 정보가 많아 제한 시간 안에 리뷰를 완성하지 못했어요. 입력 내용과 이미지는 유지됩니다."
          : "업로드한 화면과 입력 내용은 그대로 유지됩니다. 잠시 후 다시 시도해주세요."}
      </p>
      {process.env.NODE_ENV === "development" && stage ? (
        <p className="mt-3 font-mono text-xs text-ink-faint">실패 stage: {stage}</p>
      ) : null}
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Button type="button" className="min-h-11" onClick={onRetry}>
          다시 시도
        </Button>
        <Button type="button" variant="secondary" className="min-h-11" onClick={onBackToEdit}>
          입력 내용으로 돌아가기
        </Button>
      </div>
    </section>
  );
}
