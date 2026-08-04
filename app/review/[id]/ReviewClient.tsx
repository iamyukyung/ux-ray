"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScanningState } from "@/components/report/ScanningState";
import { ReportErrorState } from "@/components/report/ReportErrorState";
import { ReportEmptyState } from "@/components/report/ReportEmptyState";
import { ReportHeader } from "@/components/report/ReportHeader";
import { ReviewTabs, type ReviewTabId } from "@/components/report/ReviewTabs";
import { OverallTab } from "@/components/report/OverallTab";
import { DeviceTab } from "@/components/report/DeviceTab";
import { CapturedScreensSection } from "@/components/report/CapturedScreensSection";
import { ScreenshotReportSection } from "@/components/report/ScreenshotReportSection";
import { DemoDataBanner } from "@/components/report/DemoDataBanner";
import {
  captureStepIndex as getCaptureStepIndex,
  CaptureRequestError,
  requestCapture,
} from "@/lib/capture-client";
import { SCREENSHOT_ANALYSIS_STEPS } from "@/lib/analysis-steps";
import { getMockReview } from "@/lib/mock-review";
import { getScreenshotReviewContext } from "@/lib/screenshot-review-store";
import { SCREENSHOT_MOCK_STEP_DELAY_MS } from "@/lib/screenshot-review-utils";
import type { CaptureProgressStep, CaptureResult } from "@/lib/capture-types";
import type { ReviewInputType, ReviewReport, ScreenshotReviewContext } from "@/lib/types";
import { looksLikeUrl, normalizeUrl } from "@/lib/utils";

type Status = "analyzing" | "ready" | "error" | "not-found";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ReviewClient({ reportId }: { reportId: string }) {
  const searchParams = useSearchParams();
  const requestedUrl = searchParams.get("url") ?? "입력한 웹사이트";
  const inputType: ReviewInputType =
    searchParams.get("input") === "screenshots" ? "screenshots" : "url";

  const [status, setStatus] = useState<Status>("analyzing");
  const [report, setReport] = useState<ReviewReport | undefined>(undefined);
  const [capture, setCapture] = useState<CaptureResult | undefined>(undefined);
  const [screenshotContext, setScreenshotContext] = useState<
    ScreenshotReviewContext | undefined
  >(undefined);
  const [activeCaptureStep, setActiveCaptureStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [activeTab, setActiveTab] = useState<ReviewTabId>("overall");

  useEffect(() => {
    let cancelled = false;

    async function runScreenshotAnalysis(context: ScreenshotReviewContext) {
      for (let step = 0; step < SCREENSHOT_ANALYSIS_STEPS.length; step += 1) {
        if (cancelled) return;
        setActiveCaptureStep(step);
        await delay(SCREENSHOT_MOCK_STEP_DELAY_MS);
      }

      if (cancelled) return;

      const found = getMockReview(reportId);
      if (!found) {
        setStatus("not-found");
        return;
      }

      setActiveCaptureStep(SCREENSHOT_ANALYSIS_STEPS.length - 1);
      setScreenshotContext(context);
      setReport(found);
      setActiveTab("overall");
      setStatus("ready");
    }

    async function runUrlAnalysis() {
      if (reportId === "error-demo") {
        setErrorMessage("데모 오류 화면입니다. 다른 URL로 다시 시도해주세요.");
        setStatus("error");
        return;
      }

      const found = getMockReview(reportId);
      if (!found) {
        setStatus("not-found");
        return;
      }

      if (!looksLikeUrl(requestedUrl)) {
        setErrorMessage("올바른 URL을 입력해주세요.");
        setStatus("error");
        return;
      }

      const normalizedUrl = normalizeUrl(requestedUrl);

      try {
        const captureResult = await requestCapture(normalizedUrl, (step: CaptureProgressStep) => {
          if (!cancelled) {
            setActiveCaptureStep(getCaptureStepIndex(step));
          }
        });

        if (cancelled) return;

        setActiveCaptureStep(4);
        setCapture(captureResult);
        setReport(found);
        setActiveTab("overall");
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;

        const message =
          error instanceof CaptureRequestError
            ? error.message
            : "페이지 캡처 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.";

        setErrorMessage(message);
        setStatus("error");
      }
    }

    async function runAnalysis() {
      setStatus("analyzing");
      setCapture(undefined);
      setScreenshotContext(undefined);
      setErrorMessage(undefined);
      setActiveCaptureStep(0);
      setReport(undefined);

      if (inputType === "screenshots") {
        const context = getScreenshotReviewContext(reportId);
        if (!context || context.screens.length === 0) {
          setErrorMessage(
            "업로드한 화면 정보를 찾을 수 없어요. 랜딩 페이지에서 이미지를 다시 업로드해주세요."
          );
          setStatus("error");
          return;
        }

        await runScreenshotAnalysis(context);
        return;
      }

      await runUrlAnalysis();
    }

    void runAnalysis();

    return () => {
      cancelled = true;
    };
  }, [reportId, attempt, requestedUrl, inputType]);

  const handleRetry = useCallback(() => setAttempt((prev) => prev + 1), []);

  if (status === "analyzing") {
    return (
      <ScanningState
        inputType={inputType}
        url={requestedUrl}
        screenshotContext={getScreenshotReviewContext(reportId)}
        activeStepIndex={activeCaptureStep}
      />
    );
  }

  if (status === "error") {
    return (
      <ReportErrorState
        url={inputType === "screenshots" ? "업로드한 화면" : requestedUrl}
        message={errorMessage}
        onRetry={handleRetry}
      />
    );
  }

  if (status === "not-found") {
    return <ReportEmptyState reportId={reportId} />;
  }

  if (!report) {
    return null;
  }

  const displayReport = {
    ...report,
    url:
      inputType === "screenshots"
        ? screenshotContext?.projectName ?? report.url
        : capture?.normalizedUrl ?? (requestedUrl !== "입력한 웹사이트" ? requestedUrl : report.url),
  };

  return (
    <div>
      <div className="mx-auto max-w-4xl space-y-6 px-4 pt-8 sm:px-6 sm:pt-10">
        <ReportHeader report={displayReport} inputType={inputType} />
        <DemoDataBanner inputType={inputType} />
        {inputType === "screenshots" && screenshotContext ? (
          <ScreenshotReportSection context={screenshotContext} />
        ) : null}
        {inputType === "url" && capture ? <CapturedScreensSection capture={capture} /> : null}
      </div>
      <ReviewTabs
        active={activeTab}
        onChange={setActiveTab}
        desktopScore={report.desktop.score}
        mobileScore={report.mobile.score}
      />
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {activeTab === "overall" ? <OverallTab report={displayReport} /> : null}
        {activeTab === "desktop" ? (
          <DeviceTab deviceReport={report.desktop} issues={report.issues} />
        ) : null}
        {activeTab === "mobile" ? (
          <DeviceTab deviceReport={report.mobile} issues={report.issues} />
        ) : null}
      </div>
    </div>
  );
}
