"use client";

import { useState } from "react";
import { UrlForm } from "@/components/landing/UrlForm";
import { ScreenshotUploadForm } from "@/components/landing/ScreenshotUploadForm";
import type { ReviewInputType } from "@/lib/types";
import { cn } from "@/lib/utils";

const INPUT_OPTIONS: { id: ReviewInputType; label: string }[] = [
  { id: "url", label: "웹사이트 URL" },
  { id: "screenshots", label: "화면 이미지" },
];

type ScreenshotPhase = "edit" | "loading" | "report" | "error";

export function ReviewInputTabs() {
  const [inputType, setInputType] = useState<ReviewInputType>("url");
  const [screenshotPhase, setScreenshotPhase] = useState<ScreenshotPhase>("edit");

  const isReportView = inputType === "screenshots" && screenshotPhase === "report";

  return (
    <div className={cn("w-full", isReportView ? "max-w-5xl" : "max-w-3xl")}>
      <div role="tablist" aria-label="분석 방식" className="mb-6 flex flex-wrap gap-2">
        {INPUT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={inputType === option.id}
            onClick={() => setInputType(option.id)}
            className={cn(
              "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              inputType === option.id
                ? "border-ink bg-ink text-white"
                : "border-border bg-surface text-ink-muted hover:bg-surface-alt"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 탭 전환 시 입력·업로드 상태 유지를 위해 양쪽 패널을 mount 상태로 유지 */}
      <div
        role="tabpanel"
        aria-label="웹사이트 URL"
        hidden={inputType !== "url"}
        className={inputType !== "url" ? "hidden" : undefined}
      >
        <UrlForm />
      </div>
      <div
        role="tabpanel"
        aria-label="화면 이미지"
        hidden={inputType !== "screenshots"}
        className={inputType !== "screenshots" ? "hidden" : undefined}
      >
        <ScreenshotUploadForm onPhaseChange={setScreenshotPhase} />
      </div>
    </div>
  );
}
