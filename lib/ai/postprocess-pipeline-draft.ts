import type { CropMetadata } from "@/lib/ai/image-preprocess";
import type { ScreenshotReviewDraft } from "@/lib/ai/schemas/screenshot-review-draft";
import type { VisualEvidence } from "@/lib/ai/schemas/shared";
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

const EVIDENCE_EXCLUSION_LIMITATION =
  "현재 이미지에서 충분한 근거를 확보하지 못한 항목은 리뷰에서 제외했습니다.";

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

function isValidCropId(cropId: string, validCropIds: Set<string>, screenId: string): boolean {
  if (validCropIds.has(cropId)) return true;
  // Allow overview reference when no crops exist
  if (cropId === `${screenId}-overview`) return true;
  return false;
}

function sanitizeEvidence(
  evidence: VisualEvidence[],
  validScreenIds: Set<string>,
  validCropIds: Set<string>,
  cropMetaById: Map<string, CropMetadata>
): VisualEvidence[] {
  const seen = new Set<string>();
  const result: VisualEvidence[] = [];

  for (const item of evidence) {
    if (!validScreenIds.has(item.screenId)) continue;
    if (!isValidCropId(item.cropId, validCropIds, item.screenId)) continue;

    const cropMeta = cropMetaById.get(item.cropId);
    const locationLabel = cropMeta?.locationLabel ?? item.locationLabel;
    const key = `${item.screenId}:${item.cropId}:${normalizeText(item.observation)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      ...item,
      locationLabel,
    });
  }

  return result;
}

function isGenericIssue(issue: ScreenshotReviewDraft["issues"][number]): boolean {
  const combined = `${issue.title} ${issue.description} ${issue.recommendation}`;
  const normalized = normalizeText(combined);
  return GENERIC_PHRASES.some((phrase) => normalized.includes(phrase));
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

export interface PostprocessPipelineResult {
  draft: ScreenshotReviewDraft;
  excludedForInsufficientEvidence: boolean;
}

export function postprocessPipelineDraft(
  draft: ScreenshotReviewDraft,
  options: {
    reviewMode: ScreenshotReviewMode;
    validScreenIds: Set<string>;
    cropMetadata: CropMetadata[];
  }
): PostprocessPipelineResult {
  const validCropIds = new Set(options.cropMetadata.map((crop) => crop.cropId));
  for (const screenId of options.validScreenIds) {
    validCropIds.add(`${screenId}-overview`);
  }

  const cropMetaById = new Map(options.cropMetadata.map((crop) => [crop.cropId, crop]));

  const strengths = draft.strengths
    .map((strength) => {
      const evidence = sanitizeEvidence(
        strength.evidence,
        options.validScreenIds,
        validCropIds,
        cropMetaById
      );
      if (evidence.length === 0) return null;
      return { ...strength, evidence };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 4);

  let issues = draft.issues
    .map((issue) => {
      const evidence = sanitizeEvidence(
        issue.evidence,
        options.validScreenIds,
        validCropIds,
        cropMetaById
      );
      if (evidence.length === 0) return null;
      return { ...issue, evidence };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((issue) => !isGenericIssue(issue));

  issues = dedupeIssues(issues);

  issues.sort((a, b) => {
    const severityDiff = SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.title.localeCompare(b.title, "ko");
  });

  issues = issues.slice(0, maxIssueCount(options.reviewMode));

  const limitations = [...draft.limitations];
  let excludedForInsufficientEvidence = false;

  if (issues.length === 0) {
    excludedForInsufficientEvidence = true;
    if (!limitations.includes(EVIDENCE_EXCLUSION_LIMITATION)) {
      limitations.push(EVIDENCE_EXCLUSION_LIMITATION);
    }
  }

  return {
    draft: {
      ...draft,
      strengths,
      issues,
      limitations,
    },
    excludedForInsufficientEvidence,
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

export { EVIDENCE_EXCLUSION_LIMITATION, GENERIC_PHRASES };
