"use client";

import { useId, useState } from "react";
import type { InsightEvidenceItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function InsightReasoningAccordion({ evidence }: { evidence: InsightEvidenceItem[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full min-h-12 items-center justify-between gap-4 px-6 py-4 text-left sm:px-8"
      >
        <span className="text-sm font-medium text-ink">왜 그렇게 판단했나요?</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "h-4 w-4 flex-shrink-0 text-ink-muted transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        >
          <path d="M5 7.5l5 5 5-5" />
        </svg>
      </button>

      {open ? (
        <div id={panelId} className="border-t border-border px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Evidence
          </p>
          <ul className="space-y-4">
            {evidence.map((item) => (
              <li key={item.label} className="flex gap-4">
                <span
                  aria-hidden
                  className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-faint"
                />
                <div>
                  <p className="text-sm font-medium text-ink">{item.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
