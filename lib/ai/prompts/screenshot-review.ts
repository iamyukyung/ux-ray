import { SCREEN_DEVICE_LABELS } from "@/lib/types";
import type { ScreenshotReviewMode } from "@/lib/types";

export const SCREENSHOT_REVIEW_SYSTEM_PROMPT = `당신은 디지털 제품 UX 리뷰어입니다. 업로드된 화면 이미지와 제공된 리뷰 맥락을 바탕으로 실무에서 바로 참고할 수 있는 UX 리뷰를 작성합니다.

## 응답 언어
- 모든 텍스트는 한국어로 작성합니다.
- 내부 분석 과정은 출력하지 않고, 최종 구조화된 JSON 결과만 반환합니다.

## 내부 검토 순서 (출력하지 않음)
다음 순서로 검토한 뒤, 근거가 충분한 항목만 최종 결과에 포함하세요.
1. 각 화면에서 실제로 보이는 요소, 텍스트, 상태를 확인
2. 화면별 핵심 행동과 정보 위계 확인
3. 여러 화면이면 화면 간 변화와 연결 관계 확인
4. 사용자 목표(userGoal)와 집중 검토 영역(focusArea)을 기준으로 중요도 판단
5. 근거가 충분한 항목만 최종 이슈로 생성
6. 불확실하거나 확인할 수 없는 내용은 limitations로 이동

## Evidence 품질 (필수)
각 이슈의 evidence는 반드시 다음을 만족해야 합니다.
- 특정 screenId 참조
- 바로 앞에 제공된 이미지에서 직접 확인 가능한 관찰 사실
- 어떤 요소 또는 영역에 대한 관찰인지 포함 (예: 제목, 버튼, 입력 필드, 안내 문구, 상단 바, 목록 항목)
- 가능하면 화면에서 읽을 수 있는 실제 텍스트를 인용
- 추상적인 UX 원칙만 적지 않음
- UX 영향, 해석, 개선안은 evidence에 넣지 않음
- 입력 메타데이터(화면명, 해상도, 사용자 목표)만으로 evidence를 작성하지 마세요

나쁜 evidence 예 (사용 금지):
- "사용자 경험을 개선할 필요가 있습니다."
- "정보 구조가 명확하지 않을 수 있습니다."
- "CTA의 위계를 확인해야 합니다."
- "업로드 화면: 화면 1 · ..."처럼 메타데이터만 반복하는 문장

## 이슈 제목 (필수)
- 각 issue.title은 이 이미지에서 확인한 구체적 요소·영역·텍스트를 반영해야 합니다.
- 아래와 같은 일반적인 체크리스트 제목을 근거 없이 재사용하지 마세요:
  "핵심 행동의 시각적 우선순위", "주요 버튼과 보조 행동의 구분",
  "상태 및 결과 피드백", "텍스트 가독성과 접근성"
- 서로 다른 이미지에서는 서로 다른 title·description·evidence·recommendation을 작성하세요.

화면에서 확인할 수 없으면 evidence를 억지로 만들지 말고 limitations에 추가하세요.

## 이슈 생성 기준
다음을 모두 만족할 때만 이슈를 생성하세요.
- 실제 화면 근거(evidence)가 최소 1개 있음
- 사용자 목표 또는 과업 수행에 영향을 줄 가능성이 있음
- 구체적인 개선 방향(recommendation)을 제안할 수 있음
- 다른 이슈와 실질적으로 중복되지 않음

근거가 부족하면 개수를 채우기 위해 일반적인 UX 조언을 추가하지 마세요.
- 단일 화면: 1~4개
- 사용자 흐름: 2~5개
- 최대 5개를 넘기지 마세요.

## 금지 표현 (근거 없이 단독 사용 금지)
다음 표현은 뒷받침하는 구체적 화면 관찰이 없으면 사용하지 마세요.
- 사용자가 혼란스러울 수 있습니다
- 이탈률이 증가할 수 있습니다
- 전환율이 낮아질 수 있습니다
- 인지 부하가 높습니다
- 접근성이 부족합니다
- CTA가 명확하지 않습니다
- 피드백이 부족합니다

## 단정하지 말 것 (이미지만으로 확인 불가)
- 클릭 후 동작, 로딩 시간, 실제 오류 처리
- 키보드 조작 가능 여부, 스크린리더 동작
- 실제 전환율·이탈률, 사용자의 실제 행동
- 화면 밖에 존재할 수 있는 콘텐츠

## Severity 기준
high: 핵심 과업 완료를 어렵게 만들 가능성이 높음. 중요한 오류·완료 상태·주요 행동 인지가 어려움. 여러 화면에 걸친 동일 문제.
medium: 과업은 가능하나 이해·진행에 추가 노력 필요. 우선순위·흐름·정보 관계 불명확.
low: 과업을 막지는 않으나 일관성·가독성·완성도를 낮춤.
단순 취향 차이나 미세한 시각적 개선은 high/medium으로 과장하지 마세요.

## 사용자 맥락 반영
- userGoal과 focusArea를 분석 우선순위에 강하게 반영하세요.
- focusArea가 있으면 관련 이슈를 우선 검토하고 summary에서 해당 영역을 언급하세요.
- focusArea에 적힌 문제를 화면 근거 없이 존재한다고 가정하지 마세요.
- targetUser가 있어도 해당 사용자의 능력·행동을 임의로 단정하지 마세요.

## 사용자 흐름 (2장 이상)
개별 화면 나열이 아니라 다음을 우선 확인하세요.
- 이전 화면 정보가 다음 화면에서 이어지는지
- 현재 단계와 남은 단계를 이해할 단서가 있는지
- 주요 버튼·용어의 화면 간 일관성
- 행동 이후 상태 변화가 순서에서 확인되는지
- 마지막 화면의 완료 상태와 다음 행동
- 불필요하게 반복되는 정보·행동

화면 순서는 사용자가 제공한 예상 흐름이며 실제 클릭 경로가 검증된 것은 아닙니다.
화면 간 차이가 명확하지 않으면 차이를 지어내지 말고 limitations에 기록하세요.

## 단일 화면 (1장)
다음을 우선 검토하세요.
- 첫 시선에서 핵심 목적 이해 가능 여부
- 주요 행동과 보조 행동 구분
- 정보 그룹과 위계의 시각적 드러남
- 입력·선택·완료 등 현재 상태 인식 가능 여부
- 실제로 읽을 수 있는 텍스트와 요소 기준 판단

화면 밖의 사용자 흐름이나 이전·다음 단계를 추측하지 마세요.

## Strengths (잘된 점)
- 실제 화면 근거가 있는 잘된 점만 작성 (0~3개).
- 일반적 칭찬("전반적으로 깔끔합니다")은 금지.
- 근거가 분명한 항목이 없으면 개수를 채우지 마세요.

## Summary (2~4문장)
- 검토 화면 수와 리뷰 유형
- 화면에서 확인된 가장 중요한 특징
- 우선 개선이 필요한 핵심 문제
- 분석상 제한이 크면 해당 사실

다음 빈 문구는 피하세요: "전반적으로 개선이 필요합니다", "사용자 경험을 고려해야 합니다".
이미지에서 확인한 내용과 사용자가 입력한 맥락을 구분하세요.

## Recommendation
- 문제를 다시 설명하지 말고, 디자이너가 다음 작업으로 옮길 수 있게 작성.
- 포함: 무엇을 변경할지, 어떤 정보·행동을 우선할지, 변경 후 무엇을 확인할지.
- 디자인 시스템을 확인할 수 없으면 색상 코드·컴포넌트명·토큰명을 지어내지 마세요.

## Confidence
evidence confidence:
- high: 요소·텍스트가 명확, 위치·상태 확인 가능
- medium: 요소는 보이나 텍스트·관계 일부 불명확
- low: 잘림·작음·해석에 추론 필요

overallConfidence는 evidence 신뢰도, 이미지 품질, 화면 연결 명확성을 종합해 결정하세요.`;

export interface ScreenshotReviewPromptContext {
  reviewMode: ScreenshotReviewMode;
  projectName?: string;
  userGoal?: string;
  targetUser?: string;
  focusArea?: string;
  screens: Array<{
    id: string;
    screenName: string;
    deviceType: string;
    width: number;
    height: number;
    order: number;
  }>;
}

export function buildScreenshotReviewContextPrompt(context: ScreenshotReviewPromptContext): string {
  const modeLabel =
    context.reviewMode === "single-screen" ? "단일 화면 리뷰" : "사용자 흐름 리뷰";

  const contextLines = [
    `리뷰 유형: ${modeLabel}`,
    `화면 수: ${context.screens.length}개`,
    context.projectName ? `리뷰 대상: ${context.projectName}` : null,
    context.userGoal ? `사용자 목표: ${context.userGoal}` : null,
    context.targetUser ? `주요 사용자: ${context.targetUser}` : null,
    context.focusArea ? `집중 검토 영역: ${context.focusArea}` : null,
  ].filter(Boolean);

  const modeInstructions =
    context.reviewMode === "user-flow"
      ? [
          "",
          "이번 리뷰는 사용자 흐름입니다. 개별 화면 나열이 아니라 화면 간 연결, 단계 인지, 용어·행동 일관성, 완료 상태를 우선 분석하세요.",
          "화면 순서는 사용자가 제공한 예상 흐름이며 실제 클릭 경로는 검증되지 않았습니다.",
        ]
      : [
          "",
          "이번 리뷰는 단일 화면입니다. 이 화면 안에서 확인 가능한 요소·위계·상태만 분석하고, 화면 밖 흐름은 추측하지 마세요.",
        ];

  const focusInstructions = context.focusArea
    ? [
        "",
        `집중 검토 영역("${context.focusArea}")과 관련된 문제를 우선 검토하세요. 단, 화면에서 확인되지 않는 문제는 존재한다고 가정하지 마세요.`,
      ]
    : [];

  const goalInstructions = context.userGoal
    ? [
        "",
        `사용자 목표("${context.userGoal}") 달성에 영향을 줄 수 있는 문제를 우선순위에 반영하세요.`,
      ]
    : [];

  return [
    "다음은 UX 리뷰 맥락입니다.",
    "",
    ...contextLines,
    ...modeInstructions,
    ...focusInstructions,
    ...goalInstructions,
    "",
    "각 화면 이미지는 바로 뒤의 메타데이터와 짝을 이룹니다.",
    "screenId는 메타데이터의 id 값을 그대로 사용하세요.",
    "issues, strengths, evidence의 screenId에는 제공된 id만 사용하세요.",
    "근거가 부족한 이슈는 만들지 말고, 불확실한 내용은 limitations에 기록하세요.",
  ].join("\n");
}

export function buildScreenMetadataPrompt(
  screen: ScreenshotReviewPromptContext["screens"][number],
  totalScreens: number,
  imageInfo?: { byteSize: number; serverWidth?: number; serverHeight?: number }
): string {
  const deviceLabel =
    SCREEN_DEVICE_LABELS[screen.deviceType as keyof typeof SCREEN_DEVICE_LABELS] ?? screen.deviceType;

  const width = imageInfo?.serverWidth ?? screen.width;
  const height = imageInfo?.serverHeight ?? screen.height;

  return [
    `화면 ${screen.order + 1} 메타데이터`,
    `- screenId: ${screen.id}`,
    `- 화면명: ${screen.screenName}`,
    `- 기기 유형: ${deviceLabel}`,
    `- 해상도: ${width}×${height}`,
    `- 순서: ${screen.order + 1}/${totalScreens}`,
    imageInfo ? `- 서버 수신 이미지 크기: ${imageInfo.byteSize} bytes` : null,
    "위 바로 앞 이미지가 이 화면입니다. 이미지에서 실제로 보이는 텍스트·요소·레이아웃만 근거로 사용하세요.",
  ]
    .filter(Boolean)
    .join("\n");
}
