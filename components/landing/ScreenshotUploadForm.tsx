"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { SCREENSHOT_ANALYSIS_STEPS } from "@/lib/analysis-steps";
import {
  createScreenshotReview,
  ScreenshotReviewRequestError,
  type ScreenshotReviewClientErrorCode,
} from "@/lib/api/create-screenshot-review";
import { ScanningState } from "@/components/report/ScanningState";
import { ScreenshotReviewErrorState } from "@/components/landing/ScreenshotReviewErrorState";
import { ScreenshotReviewReportView } from "@/components/landing/ScreenshotReviewReportView";
import { ScreenshotReviewSummary } from "@/components/landing/ScreenshotReviewSummary";
import { ScreenFlowArrow, UploadedScreenCard } from "@/components/landing/UploadedScreenCard";
import { UploadedImageZoomModal, type ZoomCropHighlight } from "@/components/landing/UploadedImageZoomModal";
import { Button } from "@/components/ui/Button";
import type {
  DeviceType,
  ReviewLens,
  ScreenshotReviewContext,
  ScreenshotReviewDebugInfo,
  ScreenshotReviewReport,
  UploadedScreen,
} from "@/lib/types";
import { REVIEW_LENS_META } from "@/lib/types";
import {
  buildScreenshotReviewContext,
  defaultScreenName,
  getReviewModeLabel,
  getScreenshotReviewMode,
  inferDefaultDeviceType,
  isScreenConfigured,
  moveScreen,
  normalizeScreenOrders,
  reorderScreens,
  sortScreensByOrder,
} from "@/lib/screenshot-review-utils";
import {
  fileIdentityKey,
  MAX_UPLOAD_COUNT,
  readImageDimensions,
  validateIncomingFiles,
} from "@/lib/upload-validation";
import { cn } from "@/lib/utils";

type ReviewPhase = "edit" | "loading" | "report" | "error";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createScreenId(): string {
  return `screen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function fileToScreen(file: File, order: number): Promise<UploadedScreen> {
  const previewUrl = URL.createObjectURL(file);
  try {
    const { width, height } = await readImageDimensions(previewUrl);
    return {
      id: createScreenId(),
      file,
      fileName: file.name,
      previewUrl,
      width,
      height,
      fileSize: file.size,
      order,
      screenName: defaultScreenName(order),
      deviceType: inferDefaultDeviceType(width, height),
    };
  } catch {
    URL.revokeObjectURL(previewUrl);
    throw new Error(`${file.name}: 이미지를 불러올 수 없어요.`);
  }
}

interface ReviewContextFields {
  projectName: string;
  userGoal: string;
  targetUser: string;
  focusArea: string;
  reviewLens: ReviewLens;
}

const EMPTY_CONTEXT: ReviewContextFields = {
  projectName: "",
  userGoal: "",
  targetUser: "",
  focusArea: "",
  reviewLens: "general",
};

interface ScreenshotUploadFormProps {
  onPhaseChange?: (phase: ReviewPhase) => void;
}

export function ScreenshotUploadForm({ onPhaseChange }: ScreenshotUploadFormProps) {
  const inputId = useId();
  const liveRegionId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<ReviewPhase>("edit");
  const [screens, setScreens] = useState<UploadedScreen[]>([]);
  const [contextFields, setContextFields] = useState<ReviewContextFields>(EMPTY_CONTEXT);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [report, setReport] = useState<ScreenshotReviewReport | null>(null);
  const [reportDebug, setReportDebug] = useState<ScreenshotReviewDebugInfo | null>(null);
  const [reviewError, setReviewError] = useState<{
    code: ScreenshotReviewClientErrorCode;
    stage?: string;
  } | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasAiConsent, setHasAiConsent] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [zoomScreen, setZoomScreen] = useState<UploadedScreen | null>(null);
  const [zoomCropHighlight, setZoomCropHighlight] = useState<ZoomCropHighlight | null>(null);
  const zoomReturnFocusRef = useRef<HTMLElement | null>(null);

  const screensRef = useRef(screens);
  screensRef.current = screens;

  const reviewMode = getScreenshotReviewMode(screens.length);
  const allScreensConfigured = screens.length > 0 && screens.every(isScreenConfigured);
  const canConfirmReview = allScreensConfigured;

  const summaryContext = useMemo((): ScreenshotReviewContext | null => {
    return buildScreenshotReviewContext(screens, contextFields);
  }, [screens, contextFields]);

  const revokeAll = useCallback((items: UploadedScreen[]) => {
    for (const screen of items) {
      URL.revokeObjectURL(screen.previewUrl);
    }
  }, []);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  useEffect(() => {
    return () => revokeAll(screensRef.current);
  }, [revokeAll]);

  function setReviewPhase(next: ReviewPhase) {
    setPhase(next);
  }

  function resetSummaryState() {
    setShowSummary(false);
  }

  function clearReportState() {
    setReport(null);
    setReportDebug(null);
    setReviewError(null);
  }

  function updateScreens(updater: (prev: UploadedScreen[]) => UploadedScreen[]) {
    setScreens((prev) => normalizeScreenOrders(updater(prev)));
    resetSummaryState();
    clearReportState();
  }

  const addFiles = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return;

      resetSummaryState();
      clearReportState();

      const existingKeys = new Set(screens.map((screen) => fileIdentityKey(screen.file)));
      const validations = validateIncomingFiles(incoming, existingKeys, screens.length);
      const errors = validations.filter((v) => !v.accepted).map((v) => v.error!);
      const acceptedFiles = validations.filter((v) => v.accepted).map((v) => v.file);

      const added: UploadedScreen[] = [];
      const loadErrors: string[] = [];

      for (const file of acceptedFiles) {
        try {
          const screen = await fileToScreen(file, screens.length + added.length);
          added.push(screen);
        } catch (error) {
          loadErrors.push(
            error instanceof Error ? error.message : `${file.name}: 이미지를 불러올 수 없어요.`
          );
        }
      }

      if (added.length > 0) {
        setScreens((prev) => normalizeScreenOrders([...prev, ...added]));
      }

      setFileErrors([...errors, ...loadErrors]);
    },
    [screens]
  );

  async function runAiReviewGeneration() {
    const reviewContext = buildScreenshotReviewContext(screens, contextFields);
    if (!reviewContext || isGenerating) return;

    setIsGenerating(true);
    setReviewPhase("loading");
    setActiveStepIndex(0);
    setReport(null);
    setReportDebug(null);
    setReviewError(null);

    try {
      const response = await createScreenshotReview(reviewContext, (stepIndex) => {
        setActiveStepIndex(stepIndex);
      });
      setActiveStepIndex(SCREENSHOT_ANALYSIS_STEPS.length - 1);
      await delay(300);
      setReport(response.report);
      setReportDebug(response.debug ?? null);
      setReviewError(null);
      setReviewPhase("report");
    } catch (error) {
      if (error instanceof ScreenshotReviewRequestError) {
        setReviewError({ code: error.code, stage: error.stage });
      } else {
        setReviewError({ code: "INTERNAL_ERROR" });
      }
      setReviewPhase("error");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleStartReview() {
    if (!summaryContext || isGenerating || !hasAiConsent) return;
    void runAiReviewGeneration();
  }

  function handleEditInput() {
    setReviewPhase("edit");
    setShowSummary(true);
  }

  function handleStartNewReview() {
    const confirmed = window.confirm(
      "업로드한 이미지와 입력한 내용을 모두 초기화하고 새 리뷰를 시작할까요?"
    );
    if (!confirmed) return;

    revokeAll(screens);
    setScreens([]);
    setContextFields(EMPTY_CONTEXT);
    setFileErrors([]);
    setShowSummary(false);
    setReport(null);
    setReportDebug(null);
    setReviewError(null);
    setHasAiConsent(false);
    setReviewPhase("edit");
    setActiveStepIndex(0);
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    void addFiles(files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    void addFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const imageFiles = Array.from(event.clipboardData.items ?? [])
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (imageFiles.length > 0) {
      event.preventDefault();
      void addFiles(imageFiles);
    }
  }

  function handleDelete(id: string) {
    setScreens((prev) => {
      const target = prev.find((screen) => screen.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return normalizeScreenOrders(prev.filter((screen) => screen.id !== id));
    });
    resetSummaryState();
    clearReportState();
  }

  function handleScreenNameChange(id: string, name: string) {
    setScreens((prev) =>
      normalizeScreenOrders(
        prev.map((screen) => (screen.id === id ? { ...screen, screenName: name } : screen))
      )
    );
  }

  function handleScreenNameBlur(id: string) {
    setScreens((prev) =>
      normalizeScreenOrders(
        prev.map((screen) => {
          if (screen.id !== id) return screen;
          if (screen.screenName.trim()) return screen;
          return { ...screen, screenName: defaultScreenName(screen.order) };
        })
      )
    );
    resetSummaryState();
  }

  function handleDeviceTypeChange(id: string, deviceType: DeviceType) {
    updateScreens((prev) =>
      prev.map((screen) => (screen.id === id ? { ...screen, deviceType } : screen))
    );
  }

  function handleMoveUp(id: string) {
    updateScreens((prev) => moveScreen(prev, id, "up"));
  }

  function handleMoveDown(id: string) {
    updateScreens((prev) => moveScreen(prev, id, "down"));
  }

  function handleCardDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }

    updateScreens((prev) => {
      const fromIndex = prev.findIndex((screen) => screen.id === draggingId);
      const toIndex = prev.findIndex((screen) => screen.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      return reorderScreens(prev, fromIndex, toIndex);
    });

    setDraggingId(null);
    setDropTargetId(null);
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

  function handleContextChange(field: keyof ReviewContextFields, value: string) {
    setContextFields((prev) => ({ ...prev, [field]: value }));
    resetSummaryState();
    clearReportState();
  }

  function handleReviewLensChange(reviewLens: ReviewLens) {
    setContextFields((prev) => ({ ...prev, reviewLens }));
    resetSummaryState();
    clearReportState();
  }

  function handleConfirmReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canConfirmReview || !summaryContext) return;
    setShowSummary(true);
  }

  if (phase === "loading" && summaryContext) {
    return (
      <>
        <ScanningState
          inputType="screenshots"
          screenshotContext={summaryContext}
          activeStepIndex={activeStepIndex}
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

  if (phase === "report" && report) {
    return (
      <>
        <ScreenshotReviewReportView
          report={report}
          debug={reportDebug}
          screens={sortScreensByOrder(screens)}
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
      <>
        <ScreenshotReviewErrorState
          code={reviewError?.code}
          stage={reviewError?.stage}
          onRetry={() => void runAiReviewGeneration()}
          onBackToEdit={() => setReviewPhase("edit")}
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

  return (
    <>
      <form onSubmit={handleConfirmReview} className="space-y-6" noValidate>
        <div
          tabIndex={0}
          onPaste={handlePaste}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return;
            setIsDragOver(false);
          }}
          onDrop={handleDrop}
          className={cn(
            "rounded-xl border-2 border-dashed p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            isDragOver ? "border-accent bg-accent/5" : "border-border bg-surface-alt/40"
          )}
        >
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            multiple
            onChange={handleFileInputChange}
            className="sr-only"
          />

          <div className="text-center">
            <p className="text-sm font-medium text-ink">검토할 화면을 올려주세요</p>
            <p className="mt-1 text-xs text-ink-muted">PNG, JPG, WebP · 최대 10개 · 파일당 10MB</p>
            <p className="mt-1 text-xs text-ink-muted">
              출시 전 화면과 비공개 시안도 사용할 수 있어요.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 min-h-11"
              onClick={() => fileInputRef.current?.click()}
            >
              파일 선택
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-ink-muted">
            업로드한 이미지는 AI 분석을 위해 외부 AI API로 전송됩니다. UX-Ray는 이미지를 별도로
            저장하지 않습니다.
          </p>
          <p className="text-xs text-ink-muted">
            회사 내부 정보, 개인정보, 비밀번호, API 키 등 민감한 내용이 포함된 화면은 업로드하지
            마세요.
          </p>
        </div>

        <div id={liveRegionId} aria-live="polite" className="space-y-1">
          {fileErrors.length > 0 ? (
            <ul role="alert" className="space-y-1 text-sm text-critical">
              {fileErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>

        {reviewMode ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-border bg-surface-alt px-3 py-1.5 text-xs font-medium text-ink">
              {getReviewModeLabel(reviewMode, screens.length)}
            </span>
          </div>
        ) : null}

        {screens.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">
                업로드한 화면 ({screens.length}/{MAX_UPLOAD_COUNT})
              </h3>
            </div>

            {screens.length >= 2 ? (
              <p className="text-sm text-ink-muted">
                화면을 사용자가 경험하는 순서대로 정리해주세요.
              </p>
            ) : null}

            <ul
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="업로드한 화면 목록"
            >
              {screens.map((screen, index) => (
                <Fragment key={screen.id}>
                  {index > 0 && screens.length >= 2 ? (
                    <li className="list-none sm:hidden">
                      <ScreenFlowArrow />
                    </li>
                  ) : null}
                  <li className="list-none">
                    <UploadedScreenCard
                      screen={screen}
                      index={index}
                      total={screens.length}
                      isDragging={draggingId === screen.id}
                      isDropTarget={dropTargetId === screen.id}
                      onDelete={handleDelete}
                      onZoom={handleZoom}
                      onScreenNameChange={handleScreenNameChange}
                      onScreenNameBlur={handleScreenNameBlur}
                      onDeviceTypeChange={handleDeviceTypeChange}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onDragStart={setDraggingId}
                      onDragOver={setDropTargetId}
                      onDragLeave={() => setDropTargetId(null)}
                      onDrop={handleCardDrop}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTargetId(null);
                      }}
                    />
                  </li>
                </Fragment>
              ))}
            </ul>
          </div>
        ) : null}

        {screens.length > 0 ? (
          <section aria-labelledby="review-context-heading" className="space-y-4">
            <div>
              <h3 id="review-context-heading" className="text-sm font-semibold text-ink">
                리뷰 맥락
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                맥락을 입력하면 화면의 목적과 흐름을 더 정확하게 검토할 수 있어요.
              </p>
            </div>

            <div className="grid gap-4">
              <fieldset>
                <legend className="mb-1.5 block text-sm font-medium text-ink">검수 기준</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["general", "norman"] as const).map((lens) => {
                    const meta = REVIEW_LENS_META[lens];
                    const selected = contextFields.reviewLens === lens;

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
                            onChange={() => handleReviewLensChange(lens)}
                            className="mt-1 h-4 w-4 flex-shrink-0 accent-accent"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-ink">
                              {meta.inputLabel}
                            </span>
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

              <div>
                <label htmlFor="projectName" className="mb-1.5 block text-sm font-medium text-ink">
                  리뷰 대상 또는 기능명
                </label>
                <input
                  id="projectName"
                  type="text"
                  value={contextFields.projectName}
                  onChange={(event) => handleContextChange("projectName", event.target.value)}
                  placeholder="신규 회원가입 흐름"
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
                  value={contextFields.userGoal}
                  onChange={(event) => handleContextChange("userGoal", event.target.value)}
                  placeholder="계정을 생성하고 가입을 완료한다"
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
                  value={contextFields.targetUser}
                  onChange={(event) => handleContextChange("targetUser", event.target.value)}
                  placeholder="서비스를 처음 이용하는 신규 사용자"
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
                  value={contextFields.focusArea}
                  onChange={(event) => handleContextChange("focusArea", event.target.value)}
                  placeholder="단계가 너무 복잡하거나 이탈 요소가 없는지"
                  className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
              </div>
            </div>
          </section>
        ) : null}

        {showSummary && summaryContext ? (
          <>
            <ScreenshotReviewSummary context={summaryContext} />
            <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-alt/40 p-4">
              <input
                type="checkbox"
                checked={hasAiConsent}
                onChange={(event) => setHasAiConsent(event.target.checked)}
                className="mt-1 h-4 w-4 flex-shrink-0 accent-accent"
              />
              <span className="text-sm leading-relaxed text-ink">
                업로드한 이미지가 AI 분석을 위해 외부 AI API로 전송되는 데 동의합니다.
              </span>
            </label>
          </>
        ) : null}

        {showSummary && summaryContext ? (
          <Button
            type="button"
            size="lg"
            className="min-h-11"
            disabled={isGenerating || !hasAiConsent}
            onClick={handleStartReview}
          >
            이 내용으로 UX 리뷰 시작하기
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={!canConfirmReview || isGenerating} className="min-h-11">
            리뷰 내용 확인하기
          </Button>
        )}
      </form>

      <UploadedImageZoomModal
        screen={zoomScreen}
        onClose={() => setZoomScreen(null)}
        returnFocusRef={zoomReturnFocusRef}
      />
    </>
  );
}
