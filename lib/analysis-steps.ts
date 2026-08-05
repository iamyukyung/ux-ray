export interface AnalysisStep {
  id: string;
  label: string;
}

/** 분석 파이프라인 단계 — 로딩 화면과 캡처 API 진행 상태가 동일하게 사용합니다. */
export const ANALYSIS_STEPS: AnalysisStep[] = [
  { id: "connect", label: "웹사이트 접속" },
  { id: "desktop-screenshot", label: "Desktop Screenshot" },
  { id: "mobile-screenshot", label: "Mobile Screenshot" },
  { id: "structure", label: "화면 구조 수집" },
  { id: "demo-report", label: "Demo Report 생성" },
];

/** URL 기반 AI UX 리뷰 — 정밀 */
export const URL_PRECISE_ANALYSIS_STEPS: AnalysisStep[] = [
  { id: "connect-page", label: "페이지에 접속하고 있어요" },
  { id: "collect-structure", label: "화면 구조를 자세히 확인하고 있어요" },
  { id: "understand-purpose", label: "페이지 목적과 콘텐츠 흐름을 이해하고 있어요" },
  { id: "review-issues", label: "UX 개선 포인트를 검토하고 있어요" },
  { id: "verify-evidence", label: "근거와 우선순위를 다시 확인하고 있어요" },
  { id: "compose-report", label: "리뷰를 정리하고 있어요" },
];

/** URL 기반 AI UX 리뷰 — 빠른 */
export const URL_QUICK_ANALYSIS_STEPS: AnalysisStep[] = [
  { id: "connect-page", label: "화면과 콘텐츠를 확인하고 있어요" },
  { id: "review-issues", label: "핵심 UX 개선 포인트를 검토하고 있어요" },
  { id: "compose-report", label: "리뷰를 정리하고 있어요" },
];

/** @deprecated URL_PRECISE_ANALYSIS_STEPS 사용 */
export const URL_ANALYSIS_STEPS = URL_PRECISE_ANALYSIS_STEPS;

/** 이미지 기반 AI 리뷰 — 정밀 */
export const SCREENSHOT_PRECISE_ANALYSIS_STEPS: AnalysisStep[] = [
  { id: "observe-structure", label: "화면 구조를 자세히 확인하고 있어요" },
  { id: "understand-purpose", label: "페이지 목적과 콘텐츠 흐름을 이해하고 있어요" },
  { id: "review-issues", label: "UX 개선 포인트를 검토하고 있어요" },
  { id: "verify-evidence", label: "근거와 우선순위를 다시 확인하고 있어요" },
  { id: "compose-report", label: "리뷰를 정리하고 있어요" },
];

/** 이미지 기반 AI 리뷰 — 빠른 */
export const SCREENSHOT_QUICK_ANALYSIS_STEPS: AnalysisStep[] = [
  { id: "observe-structure", label: "화면과 콘텐츠를 확인하고 있어요" },
  { id: "review-issues", label: "핵심 UX 개선 포인트를 검토하고 있어요" },
  { id: "compose-report", label: "리뷰를 정리하고 있어요" },
];

/** @deprecated SCREENSHOT_PRECISE_ANALYSIS_STEPS 사용 */
export const SCREENSHOT_ANALYSIS_STEPS = SCREENSHOT_PRECISE_ANALYSIS_STEPS;

export function getUrlAnalysisSteps(reviewMode: import("@/lib/types").ReviewMode) {
  return reviewMode === "quick" ? URL_QUICK_ANALYSIS_STEPS : URL_PRECISE_ANALYSIS_STEPS;
}

export function getScreenshotAnalysisSteps(reviewMode: import("@/lib/types").ReviewMode) {
  return reviewMode === "quick"
    ? SCREENSHOT_QUICK_ANALYSIS_STEPS
    : SCREENSHOT_PRECISE_ANALYSIS_STEPS;
}
