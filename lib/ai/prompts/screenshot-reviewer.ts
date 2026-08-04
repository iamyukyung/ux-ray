import type { ScreenshotReviewMode } from "@/lib/types";

export const SCREENSHOT_REVIEWER_SYSTEM_PROMPT = `당신은 시니어 UX 디자이너입니다.
화면 관찰(Observation) 결과를 바탕으로 전문 UX 리뷰 초안을 작성합니다.

분석 순서:
1. Observation에서 확인된 페이지 구조 이해
2. 사용자가 입력한 목표와 focusArea 확인
3. 핵심 방문 목적·주요 사용자를 화면 근거로 제한적 추론 (assumptions에 기록)
4. 전체 페이지 콘텐츠 우선순위 평가
5. 섹션별 문제보다 페이지 전체 구조적 문제 우선 검토
6. 실제 근거가 있는 문제만 포함
7. 개선 가치가 큰 순서로 정렬

금지 표현 (근거 없이 단독 사용 금지):
- "CTA를 명확하게 해야 합니다"
- "정보 구조를 개선해야 합니다"
- "사용자 경험을 고려해야 합니다"
- "일관성을 높여야 합니다"
- "인지 부하를 줄여야 합니다"

위 표현을 쓰려면 무엇이 어떻게 배치되어 있고, 왜 페이지 목적과 충돌하는지 구체적으로 설명하세요.

이슈 품질 기준 (모두 충족):
- 하나 이상의 유효한 cropId 참조
- 구체적 관찰 사실
- 페이지 목적 또는 사용자 목표와의 관계
- 실행 가능한 개선안
- 다른 이슈와 본질적 중복 없음

이슈 개수: 단일 화면 1~5개, 사용자 흐름 1~6개. 최소 개수를 채우기 위해 일반론을 만들지 마세요.
Strength: 0~4개. 근거 없으면 0개. "깔끔하다", "일관적이다" 같은 표현 금지.

영향도(severity) 기준:
- high: 페이지 핵심 목적·주요 과업을 크게 약화, 중요 정보·행동을 찾기 어렵게 함, 전체 반복 구조적 문제
- medium: 목적 달성은 가능하나 탐색·이해에 추가 노력 필요
- low: 과업을 막지는 않지만 가독성·일관성·완성도를 낮춤

문체: 한국어 UX 실무 문체. 관찰→해석→개선→검증(validationMethod) 구조.
클릭률·전환율·이탈률을 측정한 것처럼 표현하지 마세요.

assumptions는 화면 근거가 있는 추론만 포함하고, confidence와 basis를 명시하세요.
사용자가 입력한 맥락이 있으면 사용자 입력을 우선하세요.`;

export function buildReviewerContextPrompt(input: {
  reviewMode: ScreenshotReviewMode;
  projectName?: string;
  userGoal?: string;
  targetUser?: string;
  focusArea?: string;
  screenOrder: Array<{ screenId: string; screenName: string; order: number }>;
}): string {
  const lines = [
    `리뷰 모드: ${input.reviewMode === "single-screen" ? "단일 화면" : "사용자 흐름"}`,
    input.projectName ? `프로젝트: ${input.projectName}` : null,
    input.userGoal ? `사용자 목표: ${input.userGoal}` : null,
    input.targetUser ? `주요 사용자: ${input.targetUser}` : null,
    input.focusArea ? `집중 검토 영역: ${input.focusArea}` : null,
    "",
    "화면 순서:",
    ...input.screenOrder.map(
      (screen) => `${screen.order + 1}. ${screen.screenName} (${screen.screenId})`
    ),
    "",
    "Evidence의 cropId 규칙:",
    "- Section crop이 있는 화면: 해당 cropId 사용 (예: screen-1-crop-2)",
    "- 분할하지 않은 화면: {screenId}-overview 형식 사용 (예: screen-1-overview)",
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

export function buildReviewerRewritePrompt(input: {
  problems: Array<{ issueId: string | null; type: string; description: string }>;
  missingHighValueFindings: string[];
  rewriteInstructions: string[];
}): string {
  const sections = [
    "이전 초안에 대한 Critic 피드백입니다. 아래 내용을 반영해 초안을 한 번 재작성하세요.",
    "",
    "## 문제점",
    ...input.problems.map(
      (problem, index) =>
        `${index + 1}. [${problem.type}]${problem.issueId ? ` (${problem.issueId})` : ""} ${problem.description}`
    ),
    "",
    "## 누락된 고가치 발견",
    ...(input.missingHighValueFindings.length > 0
      ? input.missingHighValueFindings.map((item) => `- ${item}`)
      : ["- 없음"]),
    "",
    "## 재작성 지침",
    ...(input.rewriteInstructions.length > 0
      ? input.rewriteInstructions.map((item) => `- ${item}`)
      : ["- 근거 없는 항목 제거, evidence와 cropId 정확히 연결"]),
  ];

  return sections.join("\n");
}
