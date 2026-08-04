import type { ReviewInputType } from "@/lib/types";

interface DemoDataBannerProps {
  inputType?: ReviewInputType;
}

export function DemoDataBanner({ inputType = "url" }: DemoDataBannerProps) {
  if (inputType === "screenshots") {
    return (
      <div
        role="note"
        className="rounded-xl border border-medium/30 bg-medium-soft/50 px-5 py-4 text-sm leading-relaxed text-ink"
      >
        <p className="font-medium">현재 진단 내용은 데모 데이터입니다</p>
        <p className="mt-1 text-ink-muted">
          점수, AI Insight, Issue, Generate Fix는 Mock 리포트입니다. 아래 &quot;업로드한
          화면&quot; 섹션의 이미지만 실제 업로드 결과입니다.
        </p>
      </div>
    );
  }

  return (
    <div
      role="note"
      className="rounded-xl border border-medium/30 bg-medium-soft/50 px-5 py-4 text-sm leading-relaxed text-ink"
    >
      <p className="font-medium">현재 진단 내용은 데모 데이터입니다</p>
      <p className="mt-1 text-ink-muted">
        점수, AI Insight, Issue, Generate Fix는 Mock 리포트입니다. 아래 &quot;실제 화면&quot; 섹션의
        스크린샷과 페이지 정보만 실제 캡처 결과입니다.
      </p>
    </div>
  );
}
