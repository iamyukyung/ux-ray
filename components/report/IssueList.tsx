"use client";

import { useMemo, useState } from "react";
import { IssueCard } from "@/components/report/IssueCard";
import {
  DEVICE_META,
  SEVERITY_META,
  SEVERITY_ORDER,
  type IssueDevice,
  type ReviewIssue,
  type Severity,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type SeverityFilter = "all" | Severity;
type DeviceFilter = "all" | IssueDevice;

interface IssueListProps {
  issues: ReviewIssue[];
  title?: string;
  /** 종합 탭에서만 디바이스 필터 칩을 함께 보여줍니다 */
  showDeviceFilter?: boolean;
}

export function IssueList({ issues, title = "우선순위별 UX 문제", showDeviceFilter = false }: IssueListProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all");

  const sortedIssues = useMemo(
    () =>
      [...issues].sort(
        (a, b) => SEVERITY_META[b.severity].weight - SEVERITY_META[a.severity].weight
      ),
    [issues]
  );

  const visibleIssues = sortedIssues.filter((issue) => {
    const matchesSeverity = severityFilter === "all" || issue.severity === severityFilter;
    const matchesDevice = deviceFilter === "all" || issue.device === deviceFilter;
    return matchesSeverity && matchesDevice;
  });

  const severityCounts = useMemo(() => {
    const base: Record<SeverityFilter, number> = { all: issues.length, critical: 0, high: 0, medium: 0, low: 0 };
    for (const issue of issues) base[issue.severity] += 1;
    return base;
  }, [issues]);

  return (
    <section aria-labelledby="issue-list-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="issue-list-heading" className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <p className="text-sm text-ink-muted">총 {issues.length}건 발견</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="심각도 필터">
        <FilterChip active={severityFilter === "all"} onClick={() => setSeverityFilter("all")}>
          전체 {severityCounts.all}
        </FilterChip>
        {SEVERITY_ORDER.map((severity) => (
          <FilterChip
            key={severity}
            active={severityFilter === severity}
            onClick={() => setSeverityFilter(severity)}
          >
            {SEVERITY_META[severity].label} {severityCounts[severity]}
          </FilterChip>
        ))}
      </div>

      {showDeviceFilter ? (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="환경 필터">
          <FilterChip active={deviceFilter === "all"} onClick={() => setDeviceFilter("all")}>
            모든 환경
          </FilterChip>
          <FilterChip active={deviceFilter === "desktop"} onClick={() => setDeviceFilter("desktop")}>
            {DEVICE_META.desktop.label}
          </FilterChip>
          <FilterChip active={deviceFilter === "mobile"} onClick={() => setDeviceFilter("mobile")}>
            {DEVICE_META.mobile.label}
          </FilterChip>
          <FilterChip active={deviceFilter === "both"} onClick={() => setDeviceFilter("both")}>
            양쪽 모두
          </FilterChip>
        </div>
      ) : null}

      {visibleIssues.length > 0 ? (
        <ul className="mt-5 space-y-4">
          {visibleIssues.map((issue, index) => (
            <IssueCard key={issue.id} issue={issue} index={index} />
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink-muted">
            선택한 조건에 해당하는 문제가 없어요. 다른 필터를 선택해보세요.
          </p>
        </div>
      )}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-border bg-surface text-ink-muted hover:bg-surface-alt"
      )}
    >
      {children}
    </button>
  );
}
