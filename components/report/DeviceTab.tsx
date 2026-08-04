import { CategoryScoreGrid } from "@/components/report/CategoryScoreGrid";
import { DeviceScreenshot } from "@/components/report/DeviceScreenshot";
import { IssueList } from "@/components/report/IssueList";
import { DEVICE_META, issuesForDevice, type DeviceReport, type ReviewIssue } from "@/lib/types";

export function DeviceTab({
  deviceReport,
  issues,
}: {
  deviceReport: DeviceReport;
  issues: ReviewIssue[];
}) {
  const meta = DEVICE_META[deviceReport.device];
  const deviceIssues = issuesForDevice(issues, deviceReport.device);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-surface p-6 shadow-panel sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          {meta.label} 환경 요약 · {deviceReport.viewport}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">{deviceReport.summary}</p>
      </section>

      <DeviceScreenshot
        device={deviceReport.device}
        label={deviceReport.screenshotLabel}
        viewport={deviceReport.viewport}
      />

      <CategoryScoreGrid scores={deviceReport.categoryScores} />

      <IssueList issues={deviceIssues} title={`${meta.label}에서 발견된 문제`} />
    </div>
  );
}
