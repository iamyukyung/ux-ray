"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { resolveScreenshotGeneratedFix } from "@/lib/screenshot-report-utils";
import type { GeneratedFix, ScreenshotReviewIssue, ScreenshotReviewReport } from "@/lib/types";
import { cn } from "@/lib/utils";

type PromptTab = "figma" | "cursor" | "experiment";

const PROMPT_TABS: { id: PromptTab; label: string }[] = [
  { id: "figma", label: "Figma Prompt" },
  { id: "cursor", label: "Cursor Prompt" },
  { id: "experiment", label: "Experiment Plan" },
];

interface ScreenshotGenerateFixDrawerProps {
  issue: ScreenshotReviewIssue | null;
  report: ScreenshotReviewReport | null;
  open: boolean;
  onClose: () => void;
}

export function ScreenshotGenerateFixDrawer({
  issue,
  report,
  open,
  onClose,
}: ScreenshotGenerateFixDrawerProps) {
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<PromptTab>("figma");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) setActiveTab("figma");
  }, [open, issue?.id]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open || !issue || !report) return null;

  const fix = resolveScreenshotGeneratedFix(issue, report);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col bg-surface shadow-panel",
          "rounded-t-2xl border border-border md:max-h-none md:max-w-lg md:rounded-none md:border-l md:border-t-0",
          "md:h-full md:animate-fade-up"
        )}
      >
        <header className="flex-shrink-0 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p id={titleId} className="text-sm font-semibold text-ink">
                ✨ Generate Fix
              </p>
              <p className="mt-1 text-sm leading-snug text-ink-muted">{issue.title}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Generate Fix 닫기"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-border text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
          <FixDrawerBody fix={fix} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </div>
    </div>,
    document.body
  );
}

function FixDrawerBody({
  fix,
  activeTab,
  setActiveTab,
}: {
  fix: GeneratedFix;
  activeTab: PromptTab;
  setActiveTab: (tab: PromptTab) => void;
}) {
  return (
    <>
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">수정 목표</h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{fix.goal}</p>
      </section>

      <section className="mt-8">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">Suggested Layout</h3>
        <ul className="mt-3 space-y-3">
          {fix.layoutSuggestions.map((item, index) => (
            <li key={index} className="flex gap-3 text-sm leading-relaxed text-ink">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-faint" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8">
        <div role="tablist" aria-label="Prompt 유형" className="flex flex-wrap gap-2 border-b border-border pb-3">
          {PROMPT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`screenshot-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`screenshot-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "min-h-11 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "border-ink bg-ink text-white"
                  : "border-border bg-surface text-ink-muted hover:bg-surface-alt"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === "figma" ? (
            <PromptPanel id="screenshot-panel-figma" labelledBy="screenshot-tab-figma" content={fix.figmaPrompt} />
          ) : null}
          {activeTab === "cursor" ? (
            <PromptPanel id="screenshot-panel-cursor" labelledBy="screenshot-tab-cursor" content={fix.cursorPrompt} />
          ) : null}
          {activeTab === "experiment" ? (
            <ExperimentPanel id="screenshot-panel-experiment" labelledBy="screenshot-tab-experiment" experiment={fix.experiment} />
          ) : null}
        </div>
      </div>
    </>
  );
}

function PromptPanel({ id, labelledBy, content }: { id: string; labelledBy: string; content: string }) {
  return (
    <div role="tabpanel" id={id} aria-labelledby={labelledBy}>
      <div className="relative rounded-lg border border-border bg-surface-alt">
        <div className="flex items-center justify-end border-b border-border px-3 py-2">
          <CopyButton text={content} />
        </div>
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-ink">
          {content}
        </pre>
      </div>
    </div>
  );
}

function ExperimentPanel({
  id,
  labelledBy,
  experiment,
}: {
  id: string;
  labelledBy: string;
  experiment: GeneratedFix["experiment"];
}) {
  const text = [
    "Hypothesis",
    experiment.hypothesis,
    "",
    "Metrics",
    ...experiment.metrics.map((m) => `- ${m}`),
    "",
    "Variants",
    ...experiment.variants.map((v) => `- ${v}`),
  ].join("\n");

  return (
    <div role="tabpanel" id={id} aria-labelledby={labelledBy} className="space-y-5">
      <div className="rounded-lg border border-border bg-surface-alt p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Hypothesis</p>
        <p className="mt-2 text-sm leading-relaxed text-ink">{experiment.hypothesis}</p>
      </div>
      <div className="rounded-lg border border-border bg-surface-alt p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Metrics</p>
        <ul className="mt-2 space-y-1">
          {experiment.metrics.map((metric) => (
            <li key={metric} className="text-sm text-ink">· {metric}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-border bg-surface-alt p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Variants</p>
        <ul className="mt-2 space-y-2">
          {experiment.variants.map((variant) => (
            <li key={variant} className="text-sm leading-relaxed text-ink">{variant}</li>
          ))}
        </ul>
      </div>
      <div className="flex justify-end">
        <CopyButton text={text} />
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="min-h-11 rounded-md border border-border bg-surface px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-alt"
    >
      {copied ? "복사됨" : "복사하기"}
    </button>
  );
}
