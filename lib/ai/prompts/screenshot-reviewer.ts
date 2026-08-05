import type { ReviewLens } from "@/lib/types";
import { buildNormanPrinciplesPromptReference } from "@/lib/ai/norman-principles";

const REVIEWER_BASE_PROMPT = `당신은 시니어 UX 디자이너입니다.
화면 관찰(Observation) 결과를 바탕으로 전문 UX 리뷰 초안을 작성합니다.

금지 표현 (근거 없이 단독 사용 금지):
- "CTA를 명확하게 해야 합니다"
- "정보 구조를 개선해야 합니다"
- "시그니파이어를 개선해야 합니다"
- "피드백을 강화해야 합니다"
- "개념 모델이 부족합니다"
- "노먼의 원칙을 위반합니다"

이슈 품질 기준 (모두 충족):
- 하나 이상의 유효한 cropId 참조
- 구체적 관찰 사실
- 페이지 목적 또는 사용자 목표와의 관계
- 실행 가능한 개선안
- 다른 이슈와 본질적 중복 없음

각 issue는 관찰(화면에서 보이는 것) → 영향(사용자 행동·이해 문제) → 개선(UI 변경)을 포함해야 합니다.

principle 필드:
- 화면 행동·상호작용과 명확히 연결되는 "노먼 기반 상호작용 원칙"이 있으면 key, label, rationale을 기록
- 적용 가능한 원칙이 없으면 반드시 null
- 모든 이슈에 원칙을 억지로 붙이지 마세요
- rationale은 이슈 설명을 반복하지 말고, 왜 이 원칙이 해당하는지 한 문장으로 설명

노먼 기반 상호작용 원칙 (key / label):
${buildNormanPrinciplesPromptReference()}

이슈 개수: 단일 화면 1~5개, 사용자 흐름 1~6개. 최소 개수를 채우기 위해 일반론을 만들지 마세요.
Strength: 0~4개. 근거 없으면 0개.

영향도(severity) 기준:
- high: 페이지 핵심 목적·주요 과업을 크게 약화
- medium: 목적 달성은 가능하나 탐색·이해에 추가 노력 필요
- low: 과업을 막지는 않지만 가독성·일관성·완성도를 낮춤

문체: 한국어 UX 실무 문체. 클릭률·전환율·이탈률을 측정한 것처럼 표현하지 마세요.
사용자가 입력한 맥락이 있으면 사용자 입력을 우선하세요.`;

const GENERAL_LENS_PROMPT = `검수 기준: 종합 UX 리뷰

분석 순서:
1. Observation에서 확인된 페이지 구조 이해
2. 사용자 목표와 focusArea 확인
3. 핵심 방문 목적·주요 사용자를 화면 근거로 제한적 추론 (assumptions에 기록)
4. 전체 페이지 콘텐츠 우선순위 평가
5. 섹션별 문제보다 페이지 전체 구조적 문제 우선 검토
6. 실제 근거가 있는 문제만 포함
7. 개선 가치가 큰 순서로 정렬

정보 구조·콘텐츠 전략 문제를 상호작용 원칙에 억지로 연결하지 마세요.`;

const NORMAN_LENS_PROMPT = `검수 기준: 노먼 기반 리뷰

분석 순서:
1. 페이지 또는 화면의 주요 사용자 행동 파악
2. 사용자가 행동 가능성을 발견할 수 있는지 평가
3. 행동과 결과의 관계가 예측 가능한지 평가
4. 상태와 결과에 대한 피드백이 보이는지 평가
5. 실수를 예방하거나 복구할 수 있는지 평가
6. 실제 화면 근거가 있는 이슈만 작성
7. 해당하는 노먼 기반 상호작용 원칙을 연결

페이지 목적과 사용자 목표를 무시하지 마세요.
원칙 위반 자체가 아니라 "해당 화면에서 사용자의 행동이나 이해에 어떤 영향을 주는가"를 설명하세요.

정적 이미지 한 장만 있는 경우:
- 실제 클릭·호버·드래그 동작을 확인한 것처럼 말하지 마세요
- 행동 가능성·피드백은 화면에 보이는 표현·상태에 한정해 평가
- 오류 상황이 보이지 않으면 오류 예방·복구 이슈를 만들어내지 마세요`;

export function getReviewerSystemPrompt(reviewLens: ReviewLens): string {
  const lensPrompt = reviewLens === "norman" ? NORMAN_LENS_PROMPT : GENERAL_LENS_PROMPT;
  return `${REVIEWER_BASE_PROMPT}\n\n${lensPrompt}`;
}

/** @deprecated getReviewerSystemPrompt(reviewLens) 사용 */
export const SCREENSHOT_REVIEWER_SYSTEM_PROMPT = getReviewerSystemPrompt("general");

export function buildReviewerContextPrompt(input: {
  reviewLens: ReviewLens;
  reviewMode: import("@/lib/types").ScreenshotReviewMode;
  projectName?: string;
  userGoal?: string;
  targetUser?: string;
  focusArea?: string;
  screenOrder: Array<{ screenId: string; screenName: string; order: number }>;
}): string {
  const lensLabel =
    input.reviewLens === "norman" ? "노먼 기반 리뷰" : "종합 UX 리뷰";

  const lines = [
    `검수 기준: ${lensLabel}`,
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
