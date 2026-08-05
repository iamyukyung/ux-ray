"use client";

import { useEffect, useId, useRef, useState } from "react";
import { URL_ANALYSIS_STEPS } from "@/lib/analysis-steps";
import {
  createUrlReview,
  UrlReviewRequestError,
  type UrlReviewClientErrorCode,
} from "@/lib/api/create-url-review";
import { ScanningState } from "@/components/report/ScanningState";
import { ScreenshotReviewErrorState } from "@/components/landing/ScreenshotReviewErrorState";
import { ScreenshotReviewReportView } from "@/components/landing/ScreenshotReviewReportView";
import {
  UploadedImageZoomModal,
  type ZoomCropHighlight,
} from "@/components/landing/UploadedImageZoomModal";
import { Button } from "@/components/ui/Button";
import {
  clearUrlReviewClientData,
  revokeUploadedScreenUrls,
} from "@/lib/url-review-assets";
import type {
  ReviewLens,
  ScreenshotReviewDebugInfo,
  ScreenshotReviewReport,
  UploadedScreen,
} from "@/lib/types";
import { REVIEW_LENS_META, SCREEN_DEVICE_LABELS } from "@/lib/types";
import { cn, looksLikeUrl, normalizeUrl } from "@/lib/utils";

type ReviewPhase = "edit" | "loading" | "report" | "error";

interface UrlFormFields {
  url: string;
  deviceType: "desktop" | "mobile";
  projectName: string;
  userGoal: string;
  targetUser: string;
  focusArea: string;
  reviewLens: ReviewLens;
}

const EMPTY_FIELDS: UrlFormFields = {
  url: "",
  deviceType: "desktop",
  projectName: "",
  userGoal: "",
  targetUser: "",
  focusArea: "",
  reviewLens: "general",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface UrlFormProps {
  onPhaseChange?: (phase: ReviewPhase) => void;
}

export function UrlForm({ onPhaseChange }: UrlFormProps) {
  const urlInputId = useId();
  const errorId = useId();
  const [phase, setPhase] = useState<ReviewPhase>("edit");
  const [fields, setFields] = useState<UrlFormFields>(EMPTY_FIELDS);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [hasAiConsent, setHasAiConsent] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [report, setReport] = useState<ScreenshotReviewReport | null>(null);
  const [reportDebug, setReportDebug] = useState<ScreenshotReviewDebugInfo | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [screens, setScreens] = useState<UploadedScreen[]>([]);
  const [zoomScreen, setZoomScreen] = useState<UploadedScreen | null>(null);
  const [zoomCropHighlight, setZoomCropHighlight] = useState<ZoomCropHighlight | null>(null);
  const zoomReturnFocusRef = useRef<HTMLElement | null>(null);
  const [reviewError, setReviewError] = useState<{
    code: UrlReviewClientErrorCode;
    message?: string;
    stage?: string;
  } | null>(null);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  useEffect(() => {
    return () => {
      revokeUploadedScreenUrls(screens);
    };
  }, [screens]);

  function clearReportScreens() {
    revokeUploadedScreenUrls(screens);
    setScreens([]);
  }

  function setReviewPhase(next: ReviewPhase) {
    setPhase(next);
  }

  function updateField<K extends keyof UrlFormFields>(key: K, value: UrlFormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setFieldError(null);
    setReport(null);
    setReportDebug(null);
    setReviewId(null);
    clearReportScreens();
    setReviewError(null);
  }

  function validateForm(): string | null {
    if (!fields.url.trim()) {
      return "분석할 URL을 입력해주세요.";
    }
    if (!looksLikeUrl(fields.url)) {
      return "올바른 URL을 입력해주세요.";
    }
    if (!hasAiConsent) {
      return "외부 AI 전송에 동의해야 리뷰를 시작할 수 있어요.";
    }
    return null;
  }

  async function runUrlReviewGeneration() {
    const validationError = validateForm();
    if (validationError || isGenerating) {
      setFieldError(validationError);
      return;
    }

    setIsGenerating(true);
    setReviewPhase("loading");
    setActiveStepIndex(0);
    setReport(null);
    setReportDebug(null);
    setReviewId(null);
    clearReportScreens();
    setReviewError(null);
    setFieldError(null);

    try {
      const response = await createUrlReview(
        {
          url: normalizeUrl(fields.url),
          deviceType: fields.deviceType,
          reviewLens: fields.reviewLens,
          projectName: fields.projectName.trim() || undefined,
          userGoal: fields.userGoal.trim() || undefined,
          targetUser: fields.targetUser.trim() || undefined,
          focusArea: fields.focusArea.trim() || undefined,
          externalProcessingConsent: hasAiConsent,
        },
        (stepIndex) => {
          setActiveStepIndex(stepIndex);
        }
      );

      setActiveStepIndex(URL_ANALYSIS_STEPS.length - 1);
      await delay(300);
      setReviewId(response.reviewId);
      setReport(response.report);
      setReportDebug(response.debug ?? null);
      setScreens(response.screens);
      setReviewPhase("report");
    } catch (error) {
      if (error instanceof UrlReviewRequestError) {
        setReviewError({
          code: error.code,
          message: error.message,
          stage: error.stage,
        });
      } else {
        setReviewError({ code: "INTERNAL_ERROR" });
      }
      setReviewPhase("error");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runUrlReviewGeneration();
  }

  function handleEditInput() {
    setReviewPhase("edit");
  }

  function handleStartNewReview() {
    const confirmed = window.confirm("입력한 URL과 리뷰 맥락을 모두 초기화하고 새 리뷰를 시작할까요?");
    if (!confirmed) return;

    if (reviewId) {
      void clearUrlReviewClientData(reviewId, report);
    }

    setFields(EMPTY_FIELDS);
    setHasAiConsent(false);
    setFieldError(null);
    setReport(null);
    setReportDebug(null);
    setReviewId(null);
    clearReportScreens();
    setReviewError(null);
    setActiveStepIndex(0);
    setReviewPhase("edit");
  }

  function handleZoom(screen: UploadedScreen, cropHighlight?: ZoomCropHighlight | null) {
    zoomReturnFocusRef.current = document.activeElement as HTMLElement | null;
    setZoomScreen(screen);
    setZoomCropHighlight(cropHighlight ?? null);
  }

  function handleCloseZoom() {
    setZoomScreen(null);
    setZoomCropHighlight(null);
  }

  if (phase === "loading") {
    return (
      <ScanningState
        inputType="url"
        url={normalizeUrl(fields.url)}
        deviceType={fields.deviceType}
        activeStepIndex={activeStepIndex}
      />
    );
  }

  if (phase === "report" && report) {
    return (
      <>
        <ScreenshotReviewReportView
          report={report}
          debug={reportDebug}
          screens={screens}
          assetLoadState={screens.length > 0 ? "ready" : "missing"}
          onEditInput={handleEditInput}
          onStartNewReview={handleStartNewReview}
          onZoom={handleZoom}
        />
        <UploadedImageZoomModal
          screen={zoomScreen}
          cropHighlight={zoomCropHighlight}
          onClose={handleCloseZoom}
          returnFocusRef={zoomReturnFocusRef}
        />
      </>
    );
  }

  if (phase === "error") {
    return (
      <ScreenshotReviewErrorState
        code={reviewError?.code}
        message={reviewError?.message}
        stage={reviewError?.stage}
        inputKind="url"
        onRetry={() => void runUrlReviewGeneration()}
        onBackToEdit={() => setReviewPhase("edit")}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-surface p-6 shadow-panel sm:p-8"
      noValidate
    >
      <div className="space-y-6">
        <div>
          <label htmlFor={urlInputId} className="mb-2 block text-sm font-medium text-ink">
            분석할 URL
          </label>
          <input
            id={urlInputId}
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com"
            value={fields.url}
            onChange={(event) => updateField("url", event.target.value)}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? errorId : undefined}
            className="h-12 w-full rounded-md border border-border bg-surface px-4 text-[15px] text-ink placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <p className="mt-2 text-xs text-ink-muted">
            로그인 없이 접속 가능한 공개 페이지를 분석할 수 있어요.
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            로그인 화면 내부, 사내망, 로컬 주소, 접근 권한이 필요한 페이지는 현재 분석할 수
            없어요.
          </p>
        </div>

        <fieldset className="min-w-0 border-0 p-0">
          <legend className="mb-2 block text-sm font-medium text-ink">기기 유형</legend>
          <div className="flex flex-wrap gap-2">
            {(["desktop", "mobile"] as const).map((device) => {
              const selected = fields.deviceType === device;
              return (
                <label
                  key={device}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    selected
                      ? "border-ink bg-ink text-white"
                      : "border-border bg-surface text-ink-muted hover:bg-surface-alt"
                  )}
                >
                  <input
                    type="radio"
                    name="deviceType"
                    value={device}
                    checked={selected}
                    onChange={() => updateField("deviceType", device)}
                    className="sr-only"
                  />
                  {SCREEN_DEVICE_LABELS[device]}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="min-w-0 border-0 p-0">
          <legend className="mb-1.5 block text-sm font-medium text-ink">검수 기준</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["general", "norman"] as const).map((lens) => {
              const meta = REVIEW_LENS_META[lens];
              const selected = fields.reviewLens === lens;

              return (
                <label
                  key={lens}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-lg border p-4 transition-colors",
                    selected
                      ? "border-accent bg-accent/5 ring-1 ring-accent/30"
                      : "border-border bg-surface hover:border-accent/40"
                  )}
                >
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="reviewLens"
                      value={lens}
                      checked={selected}
                      onChange={() => updateField("reviewLens", lens)}
                      className="mt-1 h-4 w-4 flex-shrink-0 accent-accent"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{meta.inputLabel}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
                        {meta.description}
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <section aria-labelledby="url-review-context-heading" className="space-y-4">
          <div>
            <h3 id="url-review-context-heading" className="text-sm font-semibold text-ink">
              리뷰 맥락
            </h3>
            <p className="mt-1 text-sm text-ink-muted">
              맥락을 입력하면 페이지 목적과 흐름을 더 정확하게 검토할 수 있어요.
            </p>
          </div>

          <div className="grid gap-4">
            <div>
              <label htmlFor="projectName" className="mb-1.5 block text-sm font-medium text-ink">
                리뷰 대상 또는 기능명
              </label>
              <input
                id="projectName"
                type="text"
                value={fields.projectName}
                onChange={(event) => updateField("projectName", event.target.value)}
                placeholder="메인 홈페이지"
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>
            <div>
              <label htmlFor="userGoal" className="mb-1.5 block text-sm font-medium text-ink">
                사용자가 달성해야 하는 목표
              </label>
              <textarea
                id="userGoal"
                rows={2}
                value={fields.userGoal}
                onChange={(event) => updateField("userGoal", event.target.value)}
                placeholder="서비스 소개를 확인하고 가입 또는 문의를 진행한다"
                className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>
            <div>
              <label htmlFor="targetUser" className="mb-1.5 block text-sm font-medium text-ink">
                주요 사용자
              </label>
              <input
                id="targetUser"
                type="text"
                value={fields.targetUser}
                onChange={(event) => updateField("targetUser", event.target.value)}
                placeholder="서비스를 처음 방문한 잠재 고객"
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>
            <div>
              <label htmlFor="focusArea" className="mb-1.5 block text-sm font-medium text-ink">
                특별히 검토받고 싶은 부분
              </label>
              <textarea
                id="focusArea"
                rows={2}
                value={fields.focusArea}
                onChange={(event) => updateField("focusArea", event.target.value)}
                placeholder="첫 화면에서 핵심 메시지와 CTA가 잘 드러나는지"
                className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>
          </div>
        </section>

        <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-alt/40 p-4">
          <input
            type="checkbox"
            checked={hasAiConsent}
            onChange={(event) => setHasAiConsent(event.target.checked)}
            className="mt-1 h-4 w-4 flex-shrink-0 accent-accent"
          />
          <span className="text-sm leading-relaxed text-ink">
            UX-Ray가 해당 공개 페이지의 화면과 구조 정보를 수집하고 AI 리뷰를 위해 외부 AI
            서비스로 전송하는 것에 동의합니다.
          </span>
        </label>

        <Button type="submit" size="lg" disabled={isGenerating} className="min-h-11 w-full sm:w-auto">
          {isGenerating ? "분석 중…" : "UX 리뷰 시작하기"}
        </Button>

        <div aria-live="polite">
          {fieldError ? (
            <p id={errorId} role="alert" className="text-sm font-medium text-critical">
              {fieldError}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
