import {
  SCREENSHOT_ISSUE_CATEGORY_META,
  type ScreenshotReviewIssue,
  type ScreenshotReviewReport,
} from "@/lib/types";
import type { GeneratedFix } from "@/lib/types";

const DEFAULT_METRICS = ["완료율", "단계 이탈률", "핵심 행동 전환율"];

function evidenceLines(issue: ScreenshotReviewIssue): string[] {
  return issue.evidence.map((item) => {
    if (typeof item === "string") return item;
    return `${item.screenName}: ${item.observation} (confidence: ${item.confidence})`;
  });
}

function screenLabels(issue: ScreenshotReviewIssue): string {
  return issue.screenReferences
    .map((ref) => `화면 ${ref.order + 1} · ${ref.screenName}`)
    .join(", ");
}

export function resolveScreenshotGeneratedFix(
  issue: ScreenshotReviewIssue,
  report: Pick<
    ScreenshotReviewReport,
    "projectName" | "userGoal" | "targetUser" | "focusArea"
  >
): GeneratedFix {
  const categoryLabel = SCREENSHOT_ISSUE_CATEGORY_META[issue.category].label;
  const screens = screenLabels(issue);
  const project = report.projectName ?? "업로드 화면 UX 리뷰";
  const goal = report.userGoal?.trim();
  const target = report.targetUser?.trim();

  const contextLines = [
    goal ? `사용자 목표: ${goal}` : null,
    target ? `주요 사용자: ${target}` : null,
    report.focusArea?.trim() ? `집중 검토: ${report.focusArea.trim()}` : null,
  ].filter(Boolean);

  const figmaPrompt = [
    `Project: ${project}`,
    `Issue: ${issue.title}`,
    `Category: ${categoryLabel}`,
    `Related screens: ${screens}`,
    "",
    ...contextLines,
    "",
    "Design task:",
    issue.recommendation,
    "",
    "Constraints:",
    "- Do not assume specific button colors, exact positions, or copy from unseen screenshots",
    "- Focus on hierarchy, flow clarity, feedback, and consistency across related screens",
    "- Annotate primary vs secondary actions and state feedback patterns",
  ]
    .filter(Boolean)
    .join("\n");

  const cursorPrompt = [
    `Improve UX for: ${issue.title}`,
    "",
    `Project: ${project}`,
    `Related screens: ${screens}`,
    ...contextLines,
    "",
    "Problem:",
    issue.description,
    "",
    "Evidence:",
    ...evidenceLines(issue).map((item) => `- ${item}`),
    "",
    "Recommendation:",
    issue.recommendation,
    "",
    "Constraints:",
    "- Do not invent component names or exact UI positions not confirmed from input",
    "- Preserve accessibility (focus, labels, touch targets)",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    goal: `${issue.title}\n\n${issue.recommendation}`,
    layoutSuggestions: [
      issue.description,
      issue.recommendation,
      `관련 화면: ${screens}`,
    ],
    figmaPrompt,
    cursorPrompt,
    experiment: {
      hypothesis: `${issue.recommendation} 적용 시, ${issue.expectedImpact.replace(/\.$/, "")} 문제가 완화될 것입니다.`,
      metrics: DEFAULT_METRICS,
      variants: [
        "Control — 현재 흐름 유지",
        `Variant A — ${issue.recommendation.slice(0, 80)}${issue.recommendation.length > 80 ? "…" : ""}`,
      ],
    },
  };
}

export function screenshotInsightToAiInsight(
  insight: ScreenshotReviewReport["insight"]
): { summary: string; confidence: number; evidence: { label: string; description: string }[] } {
  const confidenceMap = { high: 88, medium: 78, low: 72 };
  return {
    summary: insight.summary,
    confidence: confidenceMap[insight.confidence],
    evidence: insight.evidence.map((item, index) => ({
      label: `근거 ${index + 1}`,
      description: item,
    })),
  };
}

export function formatScreenReferenceLabel(order: number, screenName: string): string {
  return `화면 ${order + 1} · ${screenName}`;
}
