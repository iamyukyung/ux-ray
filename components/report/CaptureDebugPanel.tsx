import type { CapturedScreenshot } from "@/lib/capture-types";

interface CaptureDebugPanelProps {
  desktop: CapturedScreenshot;
  mobile: CapturedScreenshot;
}

function DebugRow({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-xs">
      <dt className="font-medium text-ink-muted">{label}</dt>
      <dd className="break-all font-mono text-ink">{String(value)}</dd>
    </div>
  );
}

function DeviceDebugBlock({ title, shot }: { title: string; shot: CapturedScreenshot }) {
  const uaLooksMobile = /Mobile|iPhone|Android/i.test(shot.userAgent);

  return (
    <div className="rounded-lg border border-border bg-surface-alt p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink">{title}</h3>
      <dl className="mt-3 space-y-2">
        <DebugRow label="requestedUrl" value={shot.requestedUrl} />
        <DebugRow label="finalUrl" value={shot.finalUrl} />
        <DebugRow label="viewport" value={`${shot.viewportWidth}×${shot.viewportHeight}`} />
        <DebugRow label="isMobile" value={shot.isMobile} />
        <DebugRow label="hasTouch" value={shot.hasTouch} />
        <DebugRow label="deviceScaleFactor" value={shot.deviceScaleFactor} />
        <DebugRow label="imagePixels" value={`${shot.imagePixelWidth}×${shot.imagePixelHeight}`} />
        <DebugRow label="captureStatus" value={shot.captureStatus} />
        <DebugRow label="documentHeight" value={shot.documentHeight} />
        <DebugRow label="capturedHeight" value={shot.capturedHeight} />
        <DebugRow label="segments" value={shot.segments?.length ?? 0} />
        <DebugRow label="stickyOverlays" value={shot.stickyOverlays?.length ?? 0} />
        <DebugRow label="userAgent" value={shot.userAgent || "(empty)"} />
        <DebugRow label="mobile UA check" value={uaLooksMobile ? "pass" : "fail"} />
      </dl>
    </div>
  );
}

/** 개발 환경에서 Desktop/Mobile 캡처 설정 차이를 확인하기 위한 디버그 패널 */
export function CaptureDebugPanel({ desktop, mobile }: CaptureDebugPanelProps) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <details className="mt-6 rounded-lg border border-dashed border-border bg-surface-alt/50 p-4">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Capture Debug (dev only)
      </summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DeviceDebugBlock title="Desktop" shot={desktop} />
        <DeviceDebugBlock title="Mobile" shot={mobile} />
      </div>
    </details>
  );
}
