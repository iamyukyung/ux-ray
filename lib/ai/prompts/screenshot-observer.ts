export const SCREENSHOT_OBSERVER_SYSTEM_PROMPT = `당신은 UX 평가자가 아니라 화면 관찰 기록자입니다.

역할:
- 업로드된 화면에서 실제로 보이는 사실만 구조화해 기록합니다.
- UX 문제, 개선안, 사용자 행동·전환율 추측은 하지 않습니다.
- 읽을 수 없는 텍스트는 추측하지 않습니다.

원칙:
- 전체 Overview 이미지로 페이지 구조를 파악합니다.
- Section crop 이미지로 텍스트와 구성요소를 확인합니다.
- 동일 섹션이 여러 crop에 걸치면 하나의 section으로 연결합니다.
- 레이아웃 위치를 구체적으로 기록합니다.

좋은 예:
"상단 히어로에는 회사 슬로건과 두 개의 둥근 버튼이 보인다."

나쁜 예:
"CTA의 우선순위가 불명확해 사용자가 혼란스러울 수 있다."

출력은 제공된 JSON 스키마를 따릅니다.`;

export function buildObserverScreenPrompt(input: {
  screenName: string;
  deviceType: string;
  width: number;
  height: number;
  screenId: string;
  cropIds: string[];
  urlContext?: {
    requestedUrl: string;
    finalUrl: string;
    pageTitle: string | null;
    domSnapshotJson: string;
  };
}): string {
  const lines = [
    `화면 ID: ${input.screenId}`,
    `화면명: ${input.screenName}`,
    `기기 유형: ${input.deviceType}`,
    `해상도: ${input.width}×${input.height}`,
    input.cropIds.length > 0
      ? `Section crop ID 목록: ${input.cropIds.join(", ")}`
      : "이 화면은 분할하지 않았습니다. Overview와 원본 전체를 참고하세요.",
    "",
    "먼저 Overview로 전체 구조를 파악한 뒤, crop이 있으면 각 구간의 텍스트·요소를 확인하세요.",
    "screenId 필드에는 위 화면 ID를 그대로 사용하세요.",
  ];

  if (input.urlContext) {
    lines.push(
      "",
      "URL 페이지 컨텍스트:",
      `요청 URL: ${input.urlContext.requestedUrl}`,
      `최종 URL: ${input.urlContext.finalUrl}`
    );
    if (input.urlContext.pageTitle) {
      lines.push(`페이지 제목: ${input.urlContext.pageTitle}`);
    }
    lines.push(
      "",
      "DOM Snapshot (텍스트 판독 우선 참고):",
      input.urlContext.domSnapshotJson,
      "",
      "원칙:",
      "- 이미지에서 확인한 시각 구조와 DOM 구조를 함께 사용한다.",
      "- 텍스트 판독은 DOM 데이터를 우선 참고한다.",
      "- DOM에 있지만 화면에서 보이지 않는 요소는 근거로 사용하지 않는다.",
      "- DOM role만 보고 실제 화면 표현을 추측하지 않는다.",
      "- 이미지와 DOM 정보가 충돌하면 ambiguousAreas에 기록한다.",
      "- 실제 클릭 이후 동작은 확인한 것처럼 단정하지 않는다."
    );
  }

  return lines.filter((line): line is string => line !== null).join("\n");
}
