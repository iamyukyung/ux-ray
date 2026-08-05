"use client";

import type { ScreenshotReviewMode, ScreenshotReviewReport, UploadedScreen } from "@/lib/types";
import { SCREEN_DEVICE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScreenshotReviewScreensSectionProps {
  screens: UploadedScreen[];
  screenLayoutMode: ScreenshotReviewMode;
  onZoom: (screen: UploadedScreen) => void;
  highlightedScreenId?: string | null;
}

export function ScreenshotReviewScreensSection({
  screens,
  screenLayoutMode,
  onZoom,
  highlightedScreenId,
}: ScreenshotReviewScreensSectionProps) {
  const isFlow = screenLayoutMode === "user-flow" && screens.length > 1;

  return (
    <section aria-labelledby="screenshot-screens-heading" className="rounded-xl border border-border bg-surface p-6 shadow-panel sm:p-8">
      <h2 id="screenshot-screens-heading" className="text-lg font-semibold text-ink">
        검토 화면
      </h2>

      {isFlow ? (
        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {screens.map((screen, index) => (
            <div key={screen.id} className="flex flex-shrink-0 items-center gap-3">
              {index > 0 ? (
                <span className="text-ink-faint" aria-hidden>
                  →
                </span>
              ) : null}
              <ScreenCard
                screen={screen}
                onZoom={onZoom}
                highlighted={highlightedScreenId === screen.id}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:max-w-sm">
          {screens.map((screen) => (
            <ScreenCard
              key={screen.id}
              screen={screen}
              onZoom={onZoom}
              highlighted={highlightedScreenId === screen.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ScreenCard({
  screen,
  onZoom,
  highlighted,
}: {
  screen: UploadedScreen;
  onZoom: (screen: UploadedScreen) => void;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onZoom(screen)}
      className={cn(
        "w-40 flex-shrink-0 rounded-xl border bg-surface-alt/30 p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-44",
        highlighted ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-ink/30"
      )}
      aria-label={`${screen.screenName} 확대 보기`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-ink-muted">{screen.order + 1}</span>
        <span className="truncate text-[11px] text-ink-muted">
          {SCREEN_DEVICE_LABELS[screen.deviceType]}
        </span>
      </div>
      <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={screen.previewUrl} alt="" className="h-full w-full object-cover object-top" />
      </div>
      <p className="mt-2 truncate text-sm font-medium text-ink" title={screen.screenName}>
        {screen.screenName}
      </p>
      <p className="font-mono text-xs text-ink-muted">
        {screen.width}×{screen.height}
      </p>
    </button>
  );
}
