import { formatDateTime } from "@/lib/utils";
import type { ReviewInputType, ReviewReport } from "@/lib/types";

/** 탭 전환과 무관하게 항상 보이는 URL/분석 시각 메타 정보 바 */
export function ReportHeader({
  report,
  inputType = "url",
}: {
  report: ReviewReport;
  inputType?: ReviewInputType;
}) {
  const label = inputType === "screenshots" ? "분석 대상" : "분석한 URL";

  return (
    <div className="min-w-0 border-b border-border pb-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 truncate font-mono text-[15px] text-ink" title={report.url}>
        {report.url}
      </p>
      <p className="mt-1 text-xs text-ink-muted">{formatDateTime(report.analyzedAt)} 분석 완료</p>
    </div>
  );
}
