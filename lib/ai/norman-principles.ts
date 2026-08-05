import type { NormanPrincipleKey } from "@/lib/types";

export interface NormanPrincipleDefinition {
  key: NormanPrincipleKey;
  label: string;
  description: string;
}

/** 서버 내부 상수 — AI 프롬프트와 postprocess 검증에 사용 */
export const NORMAN_PRINCIPLE_DEFINITIONS: readonly NormanPrincipleDefinition[] = [
  {
    key: "discoverability_signifiers",
    label: "발견 가능성·시그니파이어",
    description:
      "사용자가 어떤 행동이 가능하고, 어디를 조작해야 하는지 화면에서 알아차릴 수 있는가.",
  },
  {
    key: "affordance",
    label: "행동 가능성",
    description:
      "요소의 형태와 표현이 사용 가능한 행동을 자연스럽게 암시하는가. 정적 이미지에서는 보이는 표현에 한정해 평가.",
  },
  {
    key: "mapping",
    label: "자연스러운 매핑",
    description:
      "조작 요소와 그 결과의 관계가 사용자가 예상하기 쉬운 방식으로 연결되는가.",
  },
  {
    key: "feedback",
    label: "피드백",
    description:
      "선택·활성·진행 상태처럼 화면에서 확인되는 피드백만 평가. 클릭 후 피드백을 확인한 것처럼 말하지 마세요.",
  },
  {
    key: "constraints",
    label: "제약",
    description:
      "불가능하거나 위험한 행동을 사전에 제한하고, 가능한 선택 범위를 이해하기 쉽게 보여주는가.",
  },
  {
    key: "conceptual_model",
    label: "개념 모델",
    description:
      "인터페이스 구조와 용어가 사용자가 서비스의 작동 방식을 이해하는 데 도움을 주는가.",
  },
  {
    key: "error_prevention_recovery",
    label: "오류 예방·복구",
    description:
      "실수를 사전에 방지하고, 실수 후 원인을 이해하고 복구할 수 있는가. 오류 상황이 보이지 않으면 만들어내지 마세요.",
  },
] as const;

const DEFINITION_BY_KEY = new Map(
  NORMAN_PRINCIPLE_DEFINITIONS.map((definition) => [definition.key, definition])
);

export function getNormanPrincipleDefinition(
  key: NormanPrincipleKey
): NormanPrincipleDefinition | undefined {
  return DEFINITION_BY_KEY.get(key);
}

export function isValidNormanPrincipleKey(key: string): key is NormanPrincipleKey {
  return DEFINITION_BY_KEY.has(key as NormanPrincipleKey);
}

export function buildNormanPrinciplesPromptReference(): string {
  return NORMAN_PRINCIPLE_DEFINITIONS.map(
    (definition, index) =>
      `${index + 1}. ${definition.label} (${definition.key})\n   ${definition.description}`
  ).join("\n");
}
