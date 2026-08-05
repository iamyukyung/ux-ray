import type { CropMetadata, ProcessedScreenImage } from "@/lib/ai/image-preprocess";
import type { ScreenshotReviewDraft } from "@/lib/ai/schemas/screenshot-review-draft";
import type { ScreenshotReviewCritique } from "@/lib/ai/schemas/screenshot-review-critique";
import type { ScreenshotObservation } from "@/lib/ai/schemas/screenshot-observation";
import type { VisualEvidence } from "@/lib/ai/schemas/shared";
import type { ScreenshotReviewMetadata } from "@/lib/ai/screenshot-review-server";
import type {
  ScreenReference,
  ScreenshotPageSummary,
  ScreenshotReviewDebugInfo,
  ScreenshotReviewIssue,
  ScreenshotReviewQuality,
  ScreenshotReviewReport,
  ScreenshotReviewStrength,
  ScreenshotVisualEvidence,
} from "@/lib/types";
import { PIPELINE_VERSION } from "@/lib/ai/config";
import { SCREEN_DEVICE_LABELS } from "@/lib/types";
import type { DeviceType } from "@/lib/types";

function buildDeviceSummary(screens: ScreenshotReviewMetadata["screens"]): string {
  const counts = { desktop: 0, mobile: 0, tablet: 0, custom: 0 };

  for (const screen of screens) {
    counts[screen.deviceType] += 1;
  }

  const parts = (Object.entries(counts) as Array<[DeviceType, number]>)
    .filter(([, count]) => count > 0)
    .map(([device, count]) => `${SCREEN_DEVICE_LABELS[device]} ${count}개`);

  return parts.join(", ");
}

function defaultProjectName(reviewMode: ScreenshotReviewMetadata["reviewMode"]): string {
  return reviewMode === "single-screen" ? "업로드 화면 UX 리뷰" : "업로드 사용자 흐름 UX 리뷰";
}

function toScreenReferences(
  screenIds: string[],
  screenMap: Map<string, ScreenshotReviewMetadata["screens"][number]>
): ScreenReference[] {
  const seen = new Set<string>();
  const refs: ScreenReference[] = [];

  for (const screenId of screenIds) {
    if (seen.has(screenId)) continue;
    const screen = screenMap.get(screenId);
    if (!screen) continue;
    seen.add(screenId);
    refs.push({
      screenId,
      screenName: screen.screenName,
      order: screen.order,
    });
  }

  return refs.sort((a, b) => a.order - b.order);
}

function mapVisualEvidence(
  evidence: VisualEvidence[],
  screenMap: Map<string, ScreenshotReviewMetadata["screens"][number]>
): ScreenshotVisualEvidence[] {
  const result: ScreenshotVisualEvidence[] = [];

  for (const item of evidence) {
    const screen = screenMap.get(item.screenId);
    if (!screen) continue;
    result.push({
      screenId: item.screenId,
      screenName: screen.screenName,
      cropId: item.cropId,
      locationLabel: item.locationLabel,
      observation: item.observation,
      confidence: item.confidence,
      source: item.source,
      domElementId: item.domElementId,
      visibleText: item.visibleText,
    });
  }

  return result;
}

export function assemblePipelineReport(input: {
  metadata: ScreenshotReviewMetadata;
  draft: ScreenshotReviewDraft;
  quality: ScreenshotReviewQuality;
  cropMetadata: CropMetadata[];
}): ScreenshotReviewReport {
  const screenMap = new Map(input.metadata.screens.map((screen) => [screen.id, screen]));

  const pageSummary: ScreenshotPageSummary = {
    probablePurpose: input.draft.pageSummary.probablePurpose,
    contentNarrative: input.draft.pageSummary.contentNarrative,
    primaryAudiences: input.draft.pageSummary.primaryAudiences,
    assumptions: input.draft.pageSummary.assumptions,
  };

  const strengths: ScreenshotReviewStrength[] = input.draft.strengths.map((strength) => {
    const evidence = mapVisualEvidence(strength.evidence, screenMap);
    const screenIds = [...new Set(evidence.map((item) => item.screenId))];
    return {
      id: strength.id,
      title: strength.title,
      description: strength.description,
      evidence,
      screenReferences: toScreenReferences(screenIds, screenMap),
    };
  });

  const issues: ScreenshotReviewIssue[] = input.draft.issues.map((issue) => {
    const evidence = mapVisualEvidence(issue.evidence, screenMap);
    const screenIds = [...new Set(evidence.map((item) => item.screenId))];

    return {
      id: issue.id,
      severity: issue.severity,
      category: issue.category,
      title: issue.title,
      description: issue.description,
      evidence,
      screenReferences: toScreenReferences(screenIds, screenMap),
      expectedImpact: issue.expectedImpact,
      recommendation: issue.recommendation,
      validationMethod: issue.validationMethod,
      principle: issue.principle ?? null,
    };
  });

  const insightEvidence = issues
    .flatMap((issue) =>
      issue.evidence.map((item) => (typeof item === "string" ? item : item.observation))
    )
    .slice(0, 5);

  return {
    inputType: input.metadata.sourceType === "url" ? "url" : "screenshots",
    sourceType: input.metadata.sourceType ?? "screenshots",
    source: input.metadata.urlSource,
    analysisType: "ai",
    pipelineVersion: PIPELINE_VERSION,
    reviewMode: input.metadata.reviewMode,
    reviewLens: input.metadata.reviewLens,
    createdAt: new Date().toISOString(),
    projectName: input.metadata.projectName ?? defaultProjectName(input.metadata.reviewMode),
    userGoal: input.metadata.userGoal,
    targetUser: input.metadata.targetUser,
    focusArea: input.metadata.focusArea,
    screenCount: input.metadata.screens.length,
    deviceSummary: buildDeviceSummary(input.metadata.screens),
    pageSummary,
    executiveSummary: input.draft.executiveSummary,
    insight: {
      summary: input.draft.executiveSummary,
      confidence: "medium",
      evidence:
        insightEvidence.length > 0 ? insightEvidence : [input.draft.executiveSummary],
    },
    strengths,
    issues,
    limitations: input.draft.limitations,
    quality: input.quality,
    cropMetadata: input.cropMetadata,
  };
}

export interface PipelineDiagnostics {
  requestId: string;
  pipelineVersion: string;
  screenCount: number;
  cropCount: number;
  imageFingerprints: string[];
  observerModel: string;
  reviewerModel: string;
  criticModel: string;
  observerMs: number;
  reviewerMs: number;
  criticMs: number;
  wasRewritten: boolean;
  finalIssueCount: number;
  qualityScores: ScreenshotReviewQuality;
  reviewLens?: import("@/lib/types").ReviewLens;
  principleTaggedIssueCount?: number;
}

export function buildPipelineDebugInfo(input: {
  requestId: string;
  diagnostics: PipelineDiagnostics;
  aiIssueCount: number;
  renderedIssueCount: number;
}): ScreenshotReviewDebugInfo {
  return {
    requestId: input.requestId,
    source: "ai",
    aiIssueCount: input.aiIssueCount,
    renderedIssueCount: input.renderedIssueCount,
    analysisType: "ai",
    pipelineVersion: PIPELINE_VERSION,
    diagnostics: input.diagnostics,
  };
}

export function logPipelineDiagnostics(diagnostics: PipelineDiagnostics): void {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[screenshot-pipeline-v2]", diagnostics);
}

export type { ScreenshotObservation, ScreenshotReviewDraft, ScreenshotReviewCritique, ProcessedScreenImage };
