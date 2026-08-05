import {
  countScreensByDevice,
  getReviewModeLabel,
  sortScreensByOrder,
} from "@/lib/screenshot-review-utils";
import {
  SCREEN_DEVICE_LABELS,
  type DeviceType,
  type ScreenReference,
  type ScreenshotIssueCategory,
  type ScreenshotIssueSeverity,
  type ScreenshotReviewContext,
  type ScreenshotReviewIssue,
  type ScreenshotReviewReport,
  type UploadedScreen,
} from "@/lib/types";

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function contextSeed(context: ScreenshotReviewContext): string {
  const screens = sortScreensByOrder(context.screens);
  return [
    context.reviewMode,
    context.projectName ?? "",
    context.userGoal ?? "",
    context.targetUser ?? "",
    context.focusArea ?? "",
    ...screens.map(
      (screen) =>
        `${screen.id}|${screen.screenName}|${screen.order}|${screen.deviceType}|${screen.width}x${screen.height}`
    ),
  ].join("::");
}

function pickSeverity(seed: number, index: number): ScreenshotIssueSeverity {
  const options: ScreenshotIssueSeverity[] = ["high", "medium", "low"];
  return options[(seed + index * 7) % options.length]!;
}

function screenRef(screen: UploadedScreen): ScreenReference {
  return {
    screenId: screen.id,
    screenName: screen.screenName,
    order: screen.order,
  };
}

function formatScreenLabel(screen: UploadedScreen): string {
  return `화면 ${screen.order + 1} · ${screen.screenName}`;
}

function deviceLabel(type: DeviceType): string {
  return SCREEN_DEVICE_LABELS[type];
}

function buildDeviceSummary(context: ScreenshotReviewContext): string {
  const counts = countScreensByDevice(context);
  const parts: string[] = [];
  if (counts.desktop) parts.push(`데스크톱 ${counts.desktop}`);
  if (counts.mobile) parts.push(`모바일 ${counts.mobile}`);
  if (counts.tablet) parts.push(`태블릿 ${counts.tablet}`);
  if (counts.custom) parts.push(`직접 지정 ${counts.custom}`);
  return parts.join(" · ") || "—";
}

function baseEvidence(screen: UploadedScreen, context: ScreenshotReviewContext): string[] {
  const items = [
    `업로드 화면: ${formatScreenLabel(screen)} (${deviceLabel(screen.deviceType)}, ${screen.width}×${screen.height})`,
    getReviewModeLabel(context.reviewMode, context.screens.length),
  ];
  if (context.userGoal?.trim()) {
    items.push(`사용자 목표(입력): ${context.userGoal.trim()}`);
  }
  if (context.focusArea?.trim()) {
    items.push(`집중 검토 영역(입력): ${context.focusArea.trim()}`);
  }
  return items;
}

function flowEvidence(
  screens: UploadedScreen[],
  context: ScreenshotReviewContext,
  refs: ScreenReference[]
): string[] {
  const labels = refs
    .map((ref) => {
      const screen = screens.find((item) => item.id === ref.screenId);
      return screen ? formatScreenLabel(screen) : ref.screenName;
    })
    .join(", ");

  const items = [
    `관련 화면: ${labels}`,
    `총 ${screens.length}개 화면으로 구성된 사용자 흐름`,
  ];
  if (context.userGoal?.trim()) {
    items.push(`사용자 목표(입력): ${context.userGoal.trim()}`);
  }
  return items;
}

function defaultProjectTitle(context: ScreenshotReviewContext): string {
  if (context.projectName?.trim()) return context.projectName.trim();
  return context.reviewMode === "single-screen"
    ? "업로드 화면 UX 리뷰"
    : "업로드 사용자 흐름 UX 리뷰";
}

function buildInsight(context: ScreenshotReviewContext, screens: UploadedScreen[]): ScreenshotReviewReport["insight"] {
  const count = screens.length;
  const modeLabel =
    context.reviewMode === "single-screen" ? "단일 화면" : `${count}개 화면으로 구성된 사용자 흐름`;

  const goalPart = context.userGoal?.trim()
    ? `\n${context.userGoal.trim()}이라는 사용자 목표가 화면에서 어떻게 전달되는지 확인할 필요가 있습니다.`
    : "";

  const focusPart = context.focusArea?.trim()
    ? `\n특히 ${context.focusArea.trim()} 관점에서 검토가 필요합니다.`
    : "";

  const targetPart = context.targetUser?.trim()
    ? `\n주요 사용자(${context.targetUser.trim()}) 관점에서 흐름의 명확성을 점검할 수 있습니다.`
    : "";

  const summary =
    context.reviewMode === "single-screen"
      ? `업로드된 1개 화면을 기준으로 ${modeLabel} 리뷰를 구성했습니다.${goalPart}${focusPart}${targetPart}\n실제 이미지 내용 분석이 아닌, 입력한 화면 정보와 맥락을 바탕으로 한 Mock 예시입니다.`
      : `총 ${count}개 화면으로 구성된 사용자 흐름입니다.${goalPart}${focusPart}${targetPart}\n화면 순서와 기기 정보를 바탕으로 흐름상 확인이 필요한 지점을 정리했습니다.`;

  const evidence: string[] = [
    `리뷰 유형: ${getReviewModeLabel(context.reviewMode, count)}`,
    `업로드 화면 수: ${count}개`,
    ...screens.map((screen) => formatScreenLabel(screen) + ` (${deviceLabel(screen.deviceType)})`),
  ];
  if (context.userGoal?.trim()) evidence.push(`사용자 목표: ${context.userGoal.trim()}`);
  if (context.focusArea?.trim()) evidence.push(`집중 검토: ${context.focusArea.trim()}`);

  return {
    summary,
    confidence: "medium",
    evidence,
  };
}

function buildSingleScreenIssues(
  screen: UploadedScreen,
  context: ScreenshotReviewContext,
  seed: number
): ScreenshotReviewIssue[] {
  const ref = screenRef(screen);
  const evidence = baseEvidence(screen, context);

  const templates: Omit<ScreenshotReviewIssue, "id" | "severity">[] = [
    {
      category: "visual-hierarchy",
      title: "핵심 행동의 시각적 우선순위",
      description:
        "화면에서 사용자가 먼저 주목해야 할 행동과 보조 정보의 위계가 명확한지 확인이 필요합니다.",
      evidence,
      screenReferences: [ref],
      expectedImpact:
        "우선순위가 불분명하면 사용자가 다음 행동을 찾는 데 시간이 걸릴 수 있습니다.",
      recommendation:
        "핵심 행동과 보조 행동의 시각적 강조 수준을 구분하고, 사용자 목표와 연결된 요소가 먼저 인지되도록 검토하세요.",
    },
    {
      category: "interaction",
      title: "주요 버튼과 보조 행동의 구분",
      description:
        "주요 행동과 보조 행동이 사용자에게 혼동 없이 구분되는지 점검이 필요합니다.",
      evidence,
      screenReferences: [ref],
      expectedImpact: "행동 선택지가 겹치면 의사결정이 지연되거나 잘못된 선택으로 이어질 수 있습니다.",
      recommendation:
        "관련 화면에서 핵심 행동과 보조 행동의 시각적 우선순위를 명확히 구분하는 개선안을 검토하세요.",
    },
    {
      category: "feedback",
      title: "상태 및 결과 피드백",
      description:
        "사용자 행동 이후 상태 변화나 결과를 인지할 수 있는 피드백 구조가 있는지 확인이 필요합니다.",
      evidence,
      screenReferences: [ref],
      expectedImpact: "피드백이 부족하면 진행 여부를 확신하기 어렵고 이탈로 이어질 수 있습니다.",
      recommendation:
        "행동 전·후 상태를 사용자가 이해할 수 있도록 피드백 패턴을 정의하고 일관되게 적용하세요.",
    },
    {
      category: "accessibility",
      title: "텍스트 가독성과 접근성",
      description:
        "화면의 정보 전달이 다양한 사용자 환경에서도 충분히 이해 가능한지 검토가 필요합니다.",
      evidence,
      screenReferences: [ref],
      expectedImpact: "가독성과 접근성이 낮으면 정보 전달력이 떨어지고 사용성 문제로 이어질 수 있습니다.",
      recommendation:
        "텍스트 대비, 터치 영역, 키보드 접근성 관점에서 화면 정보가 충분히 전달되는지 점검하세요.",
    },
  ];

  const issueCount = 3 + (seed % 2);
  return templates.slice(0, issueCount).map((template, index) => ({
    ...template,
    id: `screenshot-issue-${seed}-${index}`,
    severity: pickSeverity(seed, index),
  }));
}

function buildUserFlowIssues(
  screens: UploadedScreen[],
  context: ScreenshotReviewContext,
  seed: number
): ScreenshotReviewIssue[] {
  const first = screens[0]!;
  const last = screens[screens.length - 1]!;
  const middle =
    screens.length > 2 ? screens.slice(1, -1)[(seed % Math.max(screens.length - 2, 1))]! : null;

  const pairFirstSecond =
    screens.length >= 2 ? [screenRef(screens[0]!), screenRef(screens[1]!)] : [screenRef(first)];
  const middleRef = middle ? [screenRef(middle)] : pairFirstSecond;
  const lastRef = [screenRef(last)];
  const allRefs = screens.map(screenRef);

  const templates: Omit<ScreenshotReviewIssue, "id" | "severity">[] = [
    {
      category: "flow",
      title: "화면 간 진행 단계의 명확성",
      description:
        "업로드된 화면 순서를 따라 이동할 때 각 단계의 목적과 다음 행동이 명확한지 확인이 필요합니다.",
      evidence: flowEvidence(screens, context, pairFirstSecond),
      screenReferences: pairFirstSecond,
      expectedImpact: "단계가 불명확하면 사용자가 흐름 중간에 이탈할 가능성이 높아집니다.",
      recommendation:
        "각 화면에서 현재 단계와 다음 단계를 사용자가 이해할 수 있도록 진행 상태를 명확히 표현하세요.",
    },
    {
      category: "consistency",
      title: "이전 화면과 다음 화면의 정보 연결",
      description:
        "앞선 화면에서 제공한 정보와 다음 화면의 요구 정보가 자연스럽게 이어지는지 점검이 필요합니다.",
      evidence: flowEvidence(screens, context, pairFirstSecond),
      screenReferences: pairFirstSecond,
      expectedImpact: "정보 연결이 약하면 사용자가 입력 내용을 다시 확인하거나 흐름을 재시작할 수 있습니다.",
      recommendation:
        "화면 간 공통 정보와 새로 요구되는 정보를 구분하고, 이전 단계 맥락을 다음 화면에서도 유지하세요.",
    },
    {
      category: "feedback",
      title: "사용자 행동 이후의 피드백",
      description:
        "단계를 진행할 때마다 사용자가 자신의 행동 결과를 인지할 수 있는지 확인이 필요합니다.",
      evidence: flowEvidence(screens, context, middleRef),
      screenReferences: middleRef,
      expectedImpact: "중간 단계 피드백이 부족하면 완료 여부를 확신하기 어렵습니다.",
      recommendation:
        "단계 완료, 저장, 오류 등 주요 상태 변화에 대한 피드백 패턴을 흐름 전반에 일관되게 적용하세요.",
    },
    {
      category: "error-prevention",
      title: "중간 이탈과 오류 복구 가능성",
      description:
        "흐름 중단이나 입력 오류 상황에서 사용자가 다시 진행할 수 있는지 검토가 필요합니다.",
      evidence: flowEvidence(screens, context, middleRef),
      screenReferences: middleRef,
      expectedImpact: "복구 경로가 없으면 사용자가 처음부터 다시 시작해야 할 수 있습니다.",
      recommendation:
        "중간 이탈, 입력 오류, 네트워크 문제 등에 대비한 복구 안내와 재진입 경로를 정의하세요.",
    },
    {
      category: "navigation",
      title: "완료 상태와 다음 행동 안내",
      description:
        "마지막 화면에서 목표 달성 여부와 이후 행동이 명확히 안내되는지 확인이 필요합니다.",
      evidence: flowEvidence(screens, context, lastRef),
      screenReferences: lastRef,
      expectedImpact: "완료 이후 안내가 없으면 사용자가 다음 행동을 찾지 못할 수 있습니다.",
      recommendation:
        "흐름 완료 시점에 성공 상태와 다음에 할 수 있는 행동을 명확히 제시하세요.",
    },
    {
      category: "visual-hierarchy",
      title: "흐름 전반의 시각적 일관성",
      description:
        "여러 화면에 걸쳐 핵심 행동과 보조 정보의 위계가 일관되게 유지되는지 점검이 필요합니다.",
      evidence: flowEvidence(screens, context, allRefs.slice(0, Math.min(3, allRefs.length))),
      screenReferences: allRefs.slice(0, Math.min(3, allRefs.length)),
      expectedImpact: "화면마다 위계가 달라지면 학습 부담이 커지고 흐름 이탈이 발생할 수 있습니다.",
      recommendation:
        "흐름 전체에서 핵심 CTA, 보조 링크, 상태 표시의 시각적 규칙을 통일하세요.",
    },
  ];

  let issueCount = 4;
  if (screens.length >= 3) issueCount = 5;
  if (screens.length >= 4) issueCount = 6;

  return templates.slice(0, issueCount).map((template, index) => ({
    ...template,
    id: `screenshot-issue-${seed}-${index}`,
    severity: pickSeverity(seed, index),
  }));
}

export function generateScreenshotMockReport(
  context: ScreenshotReviewContext
): ScreenshotReviewReport {
  const screens = sortScreensByOrder(context.screens);
  if (screens.length === 0) {
    throw new Error("업로드된 화면이 없습니다.");
  }

  const seed = hashString(contextSeed(context));
  const issues =
    context.reviewMode === "single-screen"
      ? buildSingleScreenIssues(screens[0]!, context, seed)
      : buildUserFlowIssues(screens, context, seed);

  return {
    inputType: "screenshots",
    analysisType: "mock",
    reviewMode: context.reviewMode,
    reviewLens: context.reviewLens ?? "general",
    createdAt: new Date().toISOString(),
    projectName: defaultProjectTitle(context),
    userGoal: context.userGoal?.trim() || undefined,
    targetUser: context.targetUser?.trim() || undefined,
    focusArea: context.focusArea?.trim() || undefined,
    screenCount: screens.length,
    deviceSummary: buildDeviceSummary(context),
    insight: buildInsight(context, screens),
    issues,
  };
}
