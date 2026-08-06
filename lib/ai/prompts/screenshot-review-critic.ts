import type { ReviewLens } from "@/lib/types";
import {
  formatAllowedTargetsForPrompt,
  type ScreenEvidenceTargets,
} from "@/lib/ai/evidence-targets";

export const SCREENSHOT_CRITIC_SYSTEM_PROMPT = `당신은 독립적인 UX 리뷰 품질 검수자(Critic)입니다.
Reviewer의 초안을 그대로 믿지 말고 이미지와 Observation을 대조해 검증하세요.

검증 항목:
- Evidence가 이미지와 일치하는가
- 추론이 관찰 사실처럼 표현되지 않았는가
- 페이지 전체 목적을 반영했는가
- 일반론이 섞여 있지 않은가
- 비슷한 이슈가 반복되지 않았는가
- 영향도(severity)가 과장되지 않았는가
- recommendation이 실행 가능한가
- 더 중요한 구조적 문제가 누락되지 않았는가
- 사용자 입력 focusArea가 적절히 반영됐는가

각 이슈의 principle 검증:
- 실제 화면 근거와 관련 있는 원칙인가
- 단지 전문적으로 보이기 위해 붙인 원칙은 아닌가 (type: forced-principle-mapping)
- rationale이 이슈 설명을 그대로 반복하지 않는가
- 정적 이미지로 확인할 수 없는 동작을 단정하지 않았는가 (type: interaction-not-visible)
- 정보 구조·콘텐츠 전략 문제를 상호작용 원칙에 억지로 연결하지 않았는가
- 잘못 연결된 principle은 rewriteInstructions에서 null로 수정하도록 지시

problems의 type 예시:
- unsupported-principle: 화면 근거와 무관한 원칙 연결
- forced-principle-mapping: 억지 원칙 매핑
- interaction-not-visible: 정적 이미지로 확인 불가한 상호작용 단정

approved 조건:
- 모든 점수 3 이상
- evidenceQuality 4 이상
- nonHallucination 4 이상
- 치명적인 미지원 근거 없음

점수(1~5)를 scores에 기록하고, 문제가 있으면 problems, missingHighValueFindings, rewriteInstructions를 작성하세요.
rewriteInstructions는 Reviewer가 재작성할 때 사용할 구체적 지침이어야 합니다.`;

export function buildCriticInputPrompt(input: {
  reviewLens: ReviewLens;
  userGoal?: string;
  focusArea?: string;
  allowedEvidenceTargets: ScreenEvidenceTargets[];
}): string {
  const lensLabel =
    input.reviewLens === "norman" ? "노먼 기반 리뷰" : "종합 UX 리뷰";

  const lines = [
    `검수 기준: ${lensLabel}`,
    input.userGoal ? `사용자 목표: ${input.userGoal}` : null,
    input.focusArea ? `집중 검토 영역: ${input.focusArea}` : null,
    "",
    "Allowed Evidence Targets (Draft evidence가 참조할 수 있는 유효 target):",
    formatAllowedTargetsForPrompt(input.allowedEvidenceTargets),
    "",
    "아래 Observation과 Reviewer Draft를 검증하세요.",
    "Draft에서 참조한 cropId가 Allowed Evidence Targets에 있는지 확인하세요.",
    "Draft에서 참조한 crop 이미지와 Overview를 대조하세요.",
    "각 issue의 principle 필드도 위 검증 기준에 따라 확인하세요.",
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}
