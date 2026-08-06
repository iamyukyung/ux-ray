import type { CropMetadata } from "@/lib/ai/image-preprocess";
import type { ScreenshotReviewDraft } from "@/lib/ai/schemas/screenshot-review-draft";
import type { VisualEvidence } from "@/lib/ai/schemas/shared";
import {
  buildAllowedEvidenceTargetsFromMetadata,
  buildAllowedTargetLookup,
  getOverviewTarget,
  getScreenSectionCropCount,
  type AllowedEvidenceTarget,
  type ScreenEvidenceTargets,
} from "@/lib/ai/evidence-targets";
import { getNormanPrincipleDefinition, isValidNormanPrincipleKey } from "@/lib/ai/norman-principles";
import type { NormanPrinciple } from "@/lib/types";
import type { ScreenshotReviewMode } from "@/lib/types";

const GENERIC_PHRASES = [
  "cta를 명확",
  "정보 구조를 개선",
  "사용자 경험을 고려",
  "일관성을 높",
  "인지 부하를 줄",
  "사용성을 개선",
  "직관적",
];

const SEVERITY_WEIGHT: Record<"high" | "medium" | "low", number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const EVIDENCE_EXCLUSION_LIMITATION =
  "현재 이미지에서 충분한 근거를 확보하지 못한 항목은 리뷰에서 제외했습니다.";

export interface PostprocessDiagnostics {
  phase: "initial" | "rewrite";
  aiIssueCount: number;
  aiEvidenceCount: number;
  validEvidenceCount: number;
  remappedToOverviewCount: number;
  droppedEvidenceCount: number;
  droppedIssueCount: number;
  finalIssueCount: number;
  issuesLostInPostprocess: boolean;
}

export interface PostprocessPipelineResult {
  draft: ScreenshotReviewDraft;
  excludedForInsufficientEvidence: boolean;
  diagnostics: PostprocessDiagnostics;
}

export interface PostprocessPipelineOptions {
  reviewMode: ScreenshotReviewMode;
  allowedEvidenceTargets?: ScreenEvidenceTargets[];
  phase?: "initial" | "rewrite";
  /** Quick 등 레거시 호출 — allowedEvidenceTargets 미전달 시 사용 */
  validScreenIds?: Set<string>;
  cropMetadata?: CropMetadata[];
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 2)
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function countDraftEvidence(draft: ScreenshotReviewDraft): number {
  let count = 0;
  for (const strength of draft.strengths) {
    count += strength.evidence.length;
  }
  for (const issue of draft.issues) {
    count += issue.evidence.length;
  }
  return count;
}

interface SanitizeEvidenceResult {
  evidence: VisualEvidence[];
  remappedToOverviewCount: number;
  droppedEvidenceCount: number;
}

function sanitizeEvidence(
  evidence: VisualEvidence[],
  allowedTargets: ScreenEvidenceTargets[],
  targetLookup: Map<string, AllowedEvidenceTarget>
): SanitizeEvidenceResult {
  const seen = new Set<string>();
  const result: VisualEvidence[] = [];
  let remappedToOverviewCount = 0;
  let droppedEvidenceCount = 0;

  for (const item of evidence) {
    const key = `${item.screenId}:${item.cropId}`;
    const observation = item.observation?.trim() ?? "";

    if (targetLookup.has(key)) {
      if (!observation) {
        droppedEvidenceCount += 1;
        continue;
      }

      const target = targetLookup.get(key)!;
      const dedupeKey = `${item.screenId}:${item.cropId}:${normalizeText(observation)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      result.push({
        ...item,
        locationLabel: target.locationLabel,
        source: item.source ?? "visual",
        domElementId: item.domElementId ?? null,
        visibleText: item.visibleText ?? null,
      });
      continue;
    }

    const sectionCropCount = getScreenSectionCropCount(item.screenId, allowedTargets);
    const overviewTarget = getOverviewTarget(item.screenId, allowedTargets);

    if (
      sectionCropCount === 0 &&
      overviewTarget &&
      allowedTargets.some((screen) => screen.screenId === item.screenId) &&
      observation
    ) {
      const dedupeKey = `${item.screenId}:${overviewTarget.cropId}:${normalizeText(observation)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      remappedToOverviewCount += 1;

      result.push({
        ...item,
        cropId: overviewTarget.cropId,
        locationLabel: overviewTarget.locationLabel,
        source: item.source ?? "visual",
        domElementId: item.domElementId ?? null,
        visibleText: item.visibleText ?? null,
      });
      continue;
    }

    droppedEvidenceCount += 1;
  }

  return { evidence: result, remappedToOverviewCount, droppedEvidenceCount };
}

function sanitizePrinciple(
  principle: ScreenshotReviewDraft["issues"][number]["principle"]
): NormanPrinciple | null {
  if (!principle) return null;
  if (!isValidNormanPrincipleKey(principle.key)) return null;

  const definition = getNormanPrincipleDefinition(principle.key);
  if (!definition) return null;

  const rationale = principle.rationale.trim();
  if (!rationale) return null;

  return {
    key: principle.key,
    label: definition.label,
    rationale,
  };
}

function isGenericIssue(issue: ScreenshotReviewDraft["issues"][number]): boolean {
  const combined = `${issue.title} ${issue.description} ${issue.recommendation}`;
  const normalized = normalizeText(combined);
  return GENERIC_PHRASES.some((phrase) => normalized.includes(phrase));
}

function passesDeterministicIssueValidation(
  issue: ScreenshotReviewDraft["issues"][number]
): boolean {
  if (!issue.recommendation.trim()) return false;
  if (!issue.validationMethod.trim()) return false;
  if (!issue.title.trim() || !issue.description.trim()) return false;
  if (!issue.expectedImpact.trim()) return false;
  return true;
}

function dedupeIssues(
  issues: ScreenshotReviewDraft["issues"]
): ScreenshotReviewDraft["issues"] {
  const kept: ScreenshotReviewDraft["issues"] = [];

  for (const issue of issues) {
    const duplicate = kept.some(
      (existing) =>
        jaccardSimilarity(existing.title, issue.title) >= 0.55 ||
        jaccardSimilarity(existing.description, issue.description) >= 0.65
    );
    if (!duplicate) {
      kept.push(issue);
    }
  }

  return kept;
}

function maxIssueCount(reviewMode: ScreenshotReviewMode): number {
  return reviewMode === "single-screen" ? 5 : 6;
}

function resolveAllowedTargets(options: PostprocessPipelineOptions): ScreenEvidenceTargets[] {
  if (options.allowedEvidenceTargets && options.allowedEvidenceTargets.length > 0) {
    return options.allowedEvidenceTargets;
  }

  if (options.validScreenIds && options.cropMetadata) {
    return buildAllowedEvidenceTargetsFromMetadata(
      options.cropMetadata,
      options.validScreenIds
    );
  }

  return [];
}

export function postprocessPipelineDraft(
  draft: ScreenshotReviewDraft,
  options: PostprocessPipelineOptions
): PostprocessPipelineResult {
  const phase = options.phase ?? "initial";
  const aiIssueCount = draft.issues.length;
  const aiEvidenceCount = countDraftEvidence(draft);

  const allowedTargets = resolveAllowedTargets(options);
  const targetLookup = buildAllowedTargetLookup(allowedTargets);

  let remappedToOverviewCount = 0;
  let droppedEvidenceCount = 0;
  let validEvidenceCount = 0;

  const strengths = draft.strengths
    .map((strength) => {
      const sanitized = sanitizeEvidence(strength.evidence, allowedTargets, targetLookup);
      remappedToOverviewCount += sanitized.remappedToOverviewCount;
      droppedEvidenceCount += sanitized.droppedEvidenceCount;
      validEvidenceCount += sanitized.evidence.length;

      if (sanitized.evidence.length === 0) return null;
      return { ...strength, evidence: sanitized.evidence };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 4);

  const preFilterIssueCount = draft.issues.length;
  let droppedIssueCount = 0;

  let issues = draft.issues
    .map((issue) => {
      const sanitized = sanitizeEvidence(issue.evidence, allowedTargets, targetLookup);
      remappedToOverviewCount += sanitized.remappedToOverviewCount;
      droppedEvidenceCount += sanitized.droppedEvidenceCount;
      validEvidenceCount += sanitized.evidence.length;

      if (sanitized.evidence.length === 0) return null;

      const normalized = {
        ...issue,
        evidence: sanitized.evidence,
        principle: sanitizePrinciple(issue.principle),
      };

      if (!passesDeterministicIssueValidation(normalized)) return null;
      return normalized;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  droppedIssueCount += preFilterIssueCount - issues.length;

  const beforeGenericCount = issues.length;
  issues = issues.filter((issue) => !isGenericIssue(issue));
  droppedIssueCount += beforeGenericCount - issues.length;

  const beforeDedupeCount = issues.length;
  issues = dedupeIssues(issues);
  droppedIssueCount += beforeDedupeCount - issues.length;

  issues.sort((a, b) => {
    const severityDiff = SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.title.localeCompare(b.title, "ko");
  });

  const beforeSliceCount = issues.length;
  issues = issues.slice(0, maxIssueCount(options.reviewMode));
  droppedIssueCount += beforeSliceCount - issues.length;

  const limitations = [...draft.limitations];
  let excludedForInsufficientEvidence = false;

  if (issues.length === 0) {
    excludedForInsufficientEvidence = true;
    if (!limitations.includes(EVIDENCE_EXCLUSION_LIMITATION)) {
      limitations.push(EVIDENCE_EXCLUSION_LIMITATION);
    }
  }

  const finalIssueCount = issues.length;
  const issuesLostInPostprocess = aiIssueCount > 0 && finalIssueCount === 0;

  return {
    draft: {
      ...draft,
      strengths,
      issues,
      limitations,
    },
    excludedForInsufficientEvidence,
    diagnostics: {
      phase,
      aiIssueCount,
      aiEvidenceCount,
      validEvidenceCount,
      remappedToOverviewCount,
      droppedEvidenceCount,
      droppedIssueCount,
      finalIssueCount,
      issuesLostInPostprocess,
    },
  };
}

export function collectReferencedCropIds(draft: ScreenshotReviewDraft): Set<string> {
  const cropIds = new Set<string>();

  for (const strength of draft.strengths) {
    for (const evidence of strength.evidence) {
      cropIds.add(evidence.cropId);
    }
  }

  for (const issue of draft.issues) {
    for (const evidence of issue.evidence) {
      cropIds.add(evidence.cropId);
    }
  }

  return cropIds;
}

export { GENERIC_PHRASES };

export function shouldFallbackToInitialProcessedDraft(input: {
  initialProcessed: PostprocessPipelineResult;
  rewrittenDraft: ScreenshotReviewDraft;
  rewrittenProcessed: PostprocessPipelineResult;
}): boolean {
  if (input.initialProcessed.draft.issues.length === 0) return false;
  if (input.rewrittenDraft.issues.length === 0) return false;
  if (input.rewrittenProcessed.draft.issues.length > 0) return false;

  return (
    input.rewrittenProcessed.diagnostics.issuesLostInPostprocess ||
    input.rewrittenProcessed.diagnostics.droppedIssueCount > 0
  );
}
