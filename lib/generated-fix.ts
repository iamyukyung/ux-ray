import { CATEGORY_META, type GeneratedFix, type ReviewIssue } from "./types";

const DEFAULT_METRICS = ["전환율", "CTA 클릭률", "페이지 이탈률"];

function buildFigmaPrompt(issue: ReviewIssue): string {
  return [
    `Redesign the ${issue.location} section to address: ${issue.title}`,
    "",
    "Context:",
    `- Evidence: ${issue.evidence}`,
    `- Expected impact if unresolved: ${issue.userImpact}`,
    "",
    "Design requirements:",
    `- ${issue.recommendation}`,
    `- Device scope: ${issue.device}`,
    `- Category: ${CATEGORY_META[issue.category].label}`,
    "",
    "Deliverables:",
    "- Updated layout frame (desktop 1440×900 and mobile 390×844)",
    "- Clear visual hierarchy for primary vs secondary actions",
    "- Annotate spacing, contrast, and touch targets (min 44px on mobile)",
  ].join("\n");
}

function buildCursorPrompt(issue: ReviewIssue): string {
  return [
    `Fix UX issue: ${issue.title}`,
    "",
    `Location: ${issue.location}`,
    "",
    "Problem:",
    issue.evidence,
    "",
    "User impact:",
    issue.userImpact,
    "",
    "Implementation:",
    issue.recommendation,
    issue.copySuggestion ? `\nSuggested copy: "${issue.copySuggestion}"` : "",
    "",
    "Constraints:",
    "- Match existing design system tokens and component patterns",
    "- Preserve accessibility (focus states, aria labels, keyboard nav)",
    "- Test on mobile viewport (390px) and desktop (1440px)",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildExperiment(issue: ReviewIssue): GeneratedFix["experiment"] {
  return {
    hypothesis: `${issue.recommendation} 적용 시, ${issue.userImpact.replace(/\.$/, "")} 문제가 완화될 것입니다.`,
    metrics: DEFAULT_METRICS,
    variants: [
      "Control — 현재 화면 (변경 없음)",
      `Variant A — ${issue.recommendation.slice(0, 60)}${issue.recommendation.length > 60 ? "…" : ""}`,
    ],
  };
}

/**
 * generatedFix가 없거나 일부 필드만 있는 Issue에서도
 * Generate Fix Drawer가 의미 있는 콘텐츠를 표시하도록 기본값을 반환합니다.
 */
export function resolveGeneratedFix(issue: ReviewIssue): GeneratedFix {
  const fix = issue.generatedFix;

  const goal =
    fix?.goal ??
    `${issue.title}을(를) 해결해 사용자가 ${issue.location}에서 막히지 않도록 합니다.\n\n${issue.recommendation}`;

  const layoutSuggestions =
    fix?.layoutSuggestions && fix.layoutSuggestions.length > 0
      ? fix.layoutSuggestions
      : [
          `${issue.location} 영역의 정보 위계를 재배치합니다.`,
          issue.recommendation,
          `근거: ${issue.evidence}`,
        ];

  const copySuggestion = fix?.copySuggestion ?? issue.copySuggestion;

  const figmaPrompt = fix?.figmaPrompt ?? buildFigmaPrompt(issue);
  const cursorPrompt = fix?.cursorPrompt ?? buildCursorPrompt(issue);

  const experiment = fix?.experiment ?? buildExperiment(issue);

  return {
    goal,
    layoutSuggestions,
    copySuggestion,
    figmaPrompt,
    cursorPrompt,
    experiment: {
      hypothesis: experiment.hypothesis || buildExperiment(issue).hypothesis,
      metrics:
        experiment.metrics && experiment.metrics.length > 0
          ? experiment.metrics
          : DEFAULT_METRICS,
      variants:
        experiment.variants && experiment.variants.length > 0
          ? experiment.variants
          : buildExperiment(issue).variants,
    },
  };
}
