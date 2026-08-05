import type { ReviewLens, ReviewMode } from "@/lib/types";
import { buildNormanPrinciplesPromptReference } from "@/lib/ai/norman-principles";

const QUICK_BASE_PROMPT = `당신은 시니어 UX 디자이너입니다.
제공된 화면 이미지와 맥락만으로 빠른 UX 리뷰를 1회에 완성합니다.

내부 순서 (출력하지 않음):
1. 화면 구조와 문구 파악
2. 페이지 목적·과업을 제한적으로 추론
3. 실제 근거가 있는 문제만 선정
4. 영향도가 큰 문제부터 정렬
5. 실행 가능한 개선안 작성
6. Structured Output 생성

금지:
- 근거 없는 일반론 ("CTA를 명확하게", "정보 구조 개선", "일관성 향상"만 단독 사용)
- 클릭·호버·응답 속도·오류 복구를 확인한 것처럼 단정
- quality 점수 생성

Evidence (필수):
- screenId, cropId, locationLabel, observation
- source: visual | dom | visual_dom
- domElementId, visibleText (없으면 null)

Issue (필수):
- evidence 1개 이상, expectedImpact, recommendation, validationMethod
- principle: 관련성이 명확할 때만 객체, 아니면 null

개수:
- 단일 화면 issue 최대 4개, 여러 화면 최대 5개
- 근거 부족하면 1~2개만 반환해도 됨`;

const GENERAL_QUICK = `검수 기준: 종합 UX 리뷰
페이지 목적, 정보 구조, 콘텐츠 우선순위, 사용자 과업을 종합 검토하세요.`;

const NORMAN_QUICK = `검수 기준: 노먼 기반 리뷰
발견 가능성·시그니파이어, 행동 가능성, 매핑, 피드백, 제약, 개념 모델, 오류 예방·복구를 화면에 보이는 범위에서만 평가하세요.

원칙 참고:
${buildNormanPrinciplesPromptReference()}`;

export function getQuickReviewerSystemPrompt(reviewLens: ReviewLens): string {
  const lens = reviewLens === "norman" ? NORMAN_QUICK : GENERAL_QUICK;
  return `${QUICK_BASE_PROMPT}\n\n${lens}`;
}

export function buildQuickReviewerContextPrompt(input: {
  reviewMode: ReviewMode;
  reviewLens: ReviewLens;
  screenLayoutMode: import("@/lib/types").ScreenshotReviewMode;
  projectName?: string;
  userGoal?: string;
  targetUser?: string;
  focusArea?: string;
  screenOrder: Array<{ screenId: string; screenName: string; order: number }>;
  urlContext?: {
    requestedUrl: string;
    finalUrl: string;
    pageTitle: string | null;
    deviceType: "desktop" | "mobile";
    domSnapshotJson: string;
  };
}): string {
  const lines = [
    `리뷰 방식: ${input.reviewMode === "quick" ? "빠른 리뷰" : "정밀 리뷰"}`,
    `검수 기준: ${input.reviewLens === "norman" ? "노먼 기반 리뷰" : "종합 UX 리뷰"}`,
    `화면 구성: ${input.screenLayoutMode === "single-screen" ? "단일 화면" : "사용자 흐름"}`,
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
    "cropId 규칙:",
    "- 분할 crop: {screenId}-crop-{n}",
    "- 전체 overview: {screenId}-overview",
  ].filter(Boolean) as string[];

  if (input.urlContext) {
    lines.push(
      "",
      `URL: ${input.urlContext.finalUrl}`,
      input.urlContext.pageTitle ? `페이지 제목: ${input.urlContext.pageTitle}` : "",
      `기기: ${input.urlContext.deviceType}`,
      "",
      "DOM Snapshot 요약 (JSON):",
      input.urlContext.domSnapshotJson
    );
  }

  return lines.join("\n");
}
