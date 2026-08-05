"use client";

import { Button } from "@/components/ui/Button";
import type { ScreenshotReviewClientErrorCode } from "@/lib/api/create-screenshot-review";
import type { UrlReviewClientErrorCode } from "@/lib/api/create-url-review";
import { getUrlReviewErrorMessage } from "@/lib/api/create-url-review";
import { getScreenshotReviewErrorMessage } from "@/lib/api/create-screenshot-review";

type ReviewErrorCode = ScreenshotReviewClientErrorCode | UrlReviewClientErrorCode;

interface ScreenshotReviewErrorStateProps {
  code?: ReviewErrorCode;
  message?: string;
  stage?: string;
  inputKind?: "screenshots" | "url";
  onRetry: () => void;
  onBackToEdit: () => void;
}

function resolveErrorMessage(
  code: ReviewErrorCode | undefined,
  message: string | undefined,
  inputKind: "screenshots" | "url"
): string {
  if (message) return message;
  if (!code) {
    return inputKind === "url"
      ? getUrlReviewErrorMessage("INTERNAL_ERROR")
      : getScreenshotReviewErrorMessage("INTERNAL_ERROR");
  }

  if (inputKind === "url") {
    return getUrlReviewErrorMessage(code as UrlReviewClientErrorCode);
  }

  return getScreenshotReviewErrorMessage(code as ScreenshotReviewClientErrorCode);
}

export function ScreenshotReviewErrorState({
  code,
  message,
  stage,
  inputKind = "screenshots",
  onRetry,
  onBackToEdit,
}: ScreenshotReviewErrorStateProps) {
  const isTimeout = code === "PIPELINE_TIMEOUT" || code === "AI_TIMEOUT";
  const resolvedMessage = resolveErrorMessage(code, message, inputKind);
  const isUrlInput = inputKind === "url";

  return (
    <section
      aria-labelledby="screenshot-review-error-heading"
      className="rounded-xl border border-border bg-surface p-6 text-center shadow-panel sm:p-8"
    >
      <h2 id="screenshot-review-error-heading" className="text-lg font-semibold text-ink">
        {isTimeout ? "리뷰 생성 시간이 초과됐어요" : resolvedMessage}
      </h2>
      {!isTimeout ? (
        <p className="mt-2 text-sm text-ink-muted">
          {isUrlInput
            ? "입력한 URL과 리뷰 맥락은 그대로 유지됩니다. 잠시 후 다시 시도해주세요."
            : "업로드한 화면과 입력 내용은 그대로 유지됩니다. 잠시 후 다시 시도해주세요."}
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">
          {isUrlInput
            ? "페이지가 길거나 분석할 정보가 많아 제한 시간 안에 리뷰를 완성하지 못했어요. 입력 내용은 유지됩니다."
            : "화면이 길거나 분석할 정보가 많아 제한 시간 안에 리뷰를 완성하지 못했어요. 입력 내용과 이미지는 유지됩니다."}
        </p>
      )}
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
