"use client";

import { cn } from "@/lib/utils";

export interface ReviewOptionCardItem {
  value: string;
  label: string;
  description: string;
  hint?: string;
}

interface ReviewOptionCardFieldsetProps {
  legend: string;
  name: string;
  value: string;
  options: ReviewOptionCardItem[];
  onChange: (value: string) => void;
  className?: string;
}

export function ReviewOptionCardFieldset({
  legend,
  name,
  value,
  options,
  onChange,
  className,
}: ReviewOptionCardFieldsetProps) {
  return (
    <fieldset className={cn("min-w-0 border-0 p-0", className)}>
      <legend className="mb-1.5 block text-sm font-medium text-ink">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <label
              key={option.value}
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
                  name={name}
                  value={option.value}
                  checked={selected}
                  onChange={() => onChange(option.value)}
                  className="mt-1 h-4 w-4 flex-shrink-0 accent-accent"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{option.label}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
                    {option.description}
                  </span>
                  {option.hint ? (
                    <span className="mt-1 block text-xs text-ink-muted">{option.hint}</span>
                  ) : null}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
