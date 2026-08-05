"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  getScreenshotAnalysisSteps,
  getUrlAnalysisSteps,
  type AnalysisStep,
} from "@/lib/analysis-steps";
import { sortScreensByOrder } from "@/lib/screenshot-review-utils";
import type { ReviewInputType, ReviewMode, ScreenshotReviewContext } from "@/lib/types";
import { SCREEN_DEVICE_LABELS } from "@/lib/types";
import { cn, formatUrlForDisplay } from "@/lib/utils";

type StepStatus = "pending" | "active" | "done";

interface ScanningStateProps {
  inputType?: ReviewInputType;
  reviewMode?: ReviewMode;
  url?: string;
  deviceType?: "desktop" | "mobile";
  screenshotContext?: ScreenshotReviewContext;
  activeStepIndex: number;
}

export function ScanningState({
  inputType = "url",
  reviewMode = "quick",
  url = "",
  deviceType = "desktop",
  screenshotContext,
  activeStepIndex,
}: ScanningStateProps) {
  const steps =
    inputType === "screenshots"
      ? getScreenshotAnalysisSteps(reviewMode)
      : getUrlAnalysisSteps(reviewMode);
  const currentStep = steps[activeStepIndex] ?? steps[0]!;
  const sortedScreens = screenshotContext
    ? sortScreensByOrder(screenshotContext.screens)
    : [];
  const displayUrl = url ? formatUrlForDisplay(url) : "";

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-20">
      {inputType === "screenshots" ? (
        <ScreenshotPreviewStrip
          screens={sortedScreens}
          activeStepIndex={activeStepIndex}
        />
      ) : (
        <UrlCaptureFrame deviceType={deviceType} activeStepIndex={activeStepIndex} />
      )}

      {inputType === "screenshots" ? (
        <>
          <p className="mt-8 text-sm font-medium text-ink">
            {screenshotContext?.projectName ?? "업로드한 화면"}
          </p>
          <h1 className="mt-2 text-xl font-semibold text-ink">AI가 화면을 분석하고 있어요</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {sortedScreens.length}개 화면을 검토한 뒤 리포트를 구성합니다.
          </p>
        </>
      ) : (
        <>
          <p className="mt-8 max-w-md truncate font-mono text-xs text-ink-faint">{displayUrl}</p>
          <h1 className="mt-2 text-xl font-semibold text-ink">공개 페이지를 분석하고 있어요</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {SCREEN_DEVICE_LABELS[deviceType]} 화면을 캡처한 뒤 AI UX 리뷰를 생성합니다.
          </p>
        </>
      )}

      <StepList
        steps={steps}
        activeStepIndex={activeStepIndex}
        currentStep={currentStep}
        showProgressBar={false}
      />
    </div>
  );
}

function StepList({
  steps,
  activeStepIndex,
  currentStep,
  showProgressBar = true,
}: {
  steps: AnalysisStep[];
  activeStepIndex: number;
  currentStep: AnalysisStep;
  showProgressBar?: boolean;
}) {
  function getStepStatus(index: number): StepStatus {
    if (index < activeStepIndex) return "done";
    if (index === activeStepIndex) return "active";
    return "pending";
  }

  return (
    <>
      <ol aria-label="분석 진행 단계" className="mt-8 w-full max-w-sm space-y-3 text-left">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          return (
            <motion.li
              key={step.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              className="flex items-center gap-3"
            >
              <StepIndicator status={status} />
              <span
                className={
                  status === "active"
                    ? "text-sm font-medium text-ink"
                    : status === "done"
                      ? "text-sm text-ink-muted"
                      : "text-sm text-ink-faint"
                }
              >
                {step.label}
                {status === "active" ? (
                  <span className="ml-1.5 inline-flex gap-0.5" aria-hidden="true">
                    <span className="animate-pulse-soft">·</span>
                    <span className="animate-pulse-soft [animation-delay:200ms]">·</span>
                    <span className="animate-pulse-soft [animation-delay:400ms]">·</span>
                  </span>
                ) : null}
                {status === "done" ? (
                  <span className="ml-1.5 text-xs text-positive">완료</span>
                ) : null}
              </span>
            </motion.li>
          );
        })}
      </ol>

      {showProgressBar ? (
        <div className="mt-6 h-1 w-full max-w-sm overflow-hidden rounded-full bg-surface-alt">
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{
              width: `${((activeStepIndex + 1) / steps.length) * 100}%`,
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      ) : null}

      <p className="sr-only" role="status">
        {currentStep.label} 단계를 진행 중입니다.
      </p>
    </>
  );
}

function ScreenshotPreviewStrip({
  screens,
  activeStepIndex,
}: {
  screens: ScreenshotReviewContext["screens"];
  activeStepIndex: number;
}) {
  const highlightIndex = Math.min(activeStepIndex, Math.max(screens.length - 1, 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex max-w-full gap-2 overflow-x-auto pb-2"
      aria-label="업로드한 화면 미리보기"
    >
      {screens.map((screen, index) => (
        <div
          key={screen.id}
          className={cn(
            "relative h-28 w-16 flex-shrink-0 overflow-hidden rounded-lg border bg-surface sm:h-32 sm:w-20",
            index === highlightIndex ? "border-accent ring-2 ring-accent/30" : "border-border"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screen.previewUrl}
            alt={screen.screenName}
            className="h-full w-full object-cover object-top"
          />
          {index === highlightIndex ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-6 animate-scan bg-gradient-to-b from-accent/25 to-transparent" />
          ) : null}
        </div>
      ))}
    </motion.div>
  );
}

function UrlCaptureFrame({
  deviceType,
  activeStepIndex,
}: {
  deviceType: "desktop" | "mobile";
  activeStepIndex: number;
}) {
  const isDesktop = deviceType === "desktop";
  const isCapturing = activeStepIndex <= 1;
  const isAnalyzing = activeStepIndex > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <ScanFrame
        kind={isDesktop ? "desktop" : "mobile"}
        active={isCapturing}
        done={isAnalyzing}
      />
    </motion.div>
  );
}

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span
        aria-hidden
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-positive text-[10px] text-white"
      >
        ✓
      </span>
    );
  }

  if (status === "active") {
    return (
      <span
        aria-hidden
        className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center"
      >
        <span className="absolute inset-0 animate-pulse-soft rounded-full bg-accent/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-border"
    />
  );
}

function ScanFrame({
  kind,
  active,
  done,
}: {
  kind: "desktop" | "mobile";
  active: boolean;
  done: boolean;
}) {
  const isDesktop = kind === "desktop";
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-border bg-surface ${
        isDesktop ? "h-32 w-full max-w-[15rem] sm:w-60" : "h-40 w-24"
      } ${done ? "ring-1 ring-positive/30" : ""}`}
      aria-hidden="true"
    >
      <div className="space-y-2 p-3">
        <div className="h-2.5 w-2/5 rounded bg-surface-alt" />
        <div
          className={
            isDesktop ? "h-6 w-full rounded bg-surface-alt" : "h-8 w-full rounded bg-surface-alt"
          }
        />
        <div className="h-2 w-full rounded bg-surface-alt" />
        <div className="h-2 w-4/5 rounded bg-surface-alt" />
        {!isDesktop ? <div className="h-2 w-3/5 rounded bg-surface-alt" /> : null}
      </div>
      {active ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-8 animate-scan bg-gradient-to-b from-accent/25 via-accent/10 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-scan bg-accent" />
        </>
      ) : null}
    </div>
  );
}
