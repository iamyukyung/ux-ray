import type { ScreenshotAnalysis, ScreenshotAnalysisIssue } from "@/lib/ai/schemas/screenshot-analysis";
import type { ScreenshotReviewMetadata } from "@/lib/ai/screenshot-review-server";

const MAX_ISSUES = 5;

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 } as const;
const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 } as const;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(/[^\p{L}\p{N}]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

function titlesAreSimilar(a: string, b: string): boolean {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);

  if (normalizedA === normalizedB) return true;
  if (normalizedA.length >= 8 && normalizedB.length >= 8) {
    if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return true;
  }

  return jaccardSimilarity(a, b) >= 0.65;
}

function screenSetsOverlap(a: string[], b: string[]): boolean {
  const setB = new Set(b);
  return a.some((id) => setB.has(id));
}

function observationsAreSimilar(a: string, b: string): boolean {
  return jaccardSimilarity(a, b) >= 0.58;
}

function issuesAreSimilar(a: ScreenshotAnalysisIssue, b: ScreenshotAnalysisIssue): boolean {
  if (titlesAreSimilar(a.title, b.title)) return true;

  if (a.category !== b.category) return false;
  if (!screenSetsOverlap(a.screenIds, b.screenIds)) return false;

  for (const evidenceA of a.evidence) {
    for (const evidenceB of b.evidence) {
      if (
        evidenceA.screenId === evidenceB.screenId &&
        observationsAreSimilar(evidenceA.observation, evidenceB.observation)
      ) {
        return true;
      }
    }
  }

  return false;
}

function averageEvidenceConfidence(issue: ScreenshotAnalysisIssue): number {
  if (issue.evidence.length === 0) return 0;
  const total = issue.evidence.reduce((sum, item) => sum + CONFIDENCE_RANK[item.confidence], 0);
  return total / issue.evidence.length;
}

function contextRelevanceScore(issue: ScreenshotAnalysisIssue, metadata: ScreenshotReviewMetadata): number {
  let score = 0;
  const issueText = `${issue.title} ${issue.description} ${issue.evidence.map((item) => item.observation).join(" ")}`;

  if (metadata.focusArea) {
    score += jaccardSimilarity(issueText, metadata.focusArea) * 40;
  }

  if (metadata.userGoal) {
    score += jaccardSimilarity(issueText, metadata.userGoal) * 30;
  }

  return score;
}

function issuePriorityScore(issue: ScreenshotAnalysisIssue, metadata: ScreenshotReviewMetadata): number {
  const severityScore = SEVERITY_RANK[issue.severity] * 100;
  const evidenceScore = issue.evidence.length * 8;
  const confidenceScore = averageEvidenceConfidence(issue) * 12;
  const contextScore = contextRelevanceScore(issue, metadata);

  return severityScore + evidenceScore + confidenceScore + contextScore;
}

function choosePreferredIssue(
  current: ScreenshotAnalysisIssue,
  candidate: ScreenshotAnalysisIssue,
  metadata: ScreenshotReviewMetadata
): ScreenshotAnalysisIssue {
  const currentScore = issuePriorityScore(current, metadata);
  const candidateScore = issuePriorityScore(candidate, metadata);

  if (candidateScore !== currentScore) {
    return candidateScore > currentScore ? candidate : current;
  }

  if (candidate.evidence.length !== current.evidence.length) {
    return candidate.evidence.length > current.evidence.length ? candidate : current;
  }

  return candidate.title.length >= current.title.length ? candidate : current;
}

function mergeScreenIds(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

function deduplicateIssues(
  issues: ScreenshotAnalysisIssue[],
  metadata: ScreenshotReviewMetadata
): ScreenshotAnalysisIssue[] {
  const result: ScreenshotAnalysisIssue[] = [];

  for (const issue of issues) {
    const duplicateIndex = result.findIndex((existing) => issuesAreSimilar(existing, issue));

    if (duplicateIndex === -1) {
      result.push(issue);
      continue;
    }

    const existing = result[duplicateIndex]!;
    const preferred = choosePreferredIssue(existing, issue, metadata);
    const mergedEvidence = [...existing.evidence];

    for (const evidence of issue.evidence) {
      const alreadyExists = mergedEvidence.some(
        (item) =>
          item.screenId === evidence.screenId &&
          observationsAreSimilar(item.observation, evidence.observation)
      );
      if (!alreadyExists) mergedEvidence.push(evidence);
    }

    result[duplicateIndex] = {
      ...preferred,
      screenIds: mergeScreenIds(existing.screenIds, issue.screenIds),
      evidence: mergedEvidence,
    };
  }

  return result;
}

function alignIssueScreenIds(issue: ScreenshotAnalysisIssue): ScreenshotAnalysisIssue {
  const evidenceScreenIds = issue.evidence.map((item) => item.screenId);
  const screenIds = mergeScreenIds(issue.screenIds, evidenceScreenIds);

  return {
    ...issue,
    screenIds,
  };
}

function sanitizeIssueScreenIds(
  issue: ScreenshotAnalysisIssue,
  validIds: Set<string>
): ScreenshotAnalysisIssue | null {
  const evidence = issue.evidence.filter((item) => validIds.has(item.screenId));
  if (evidence.length === 0) return null;

  const aligned = alignIssueScreenIds({ ...issue, evidence });
  const screenIds = aligned.screenIds.filter((id) => validIds.has(id));

  if (screenIds.length === 0) return null;

  return {
    ...aligned,
    screenIds,
    evidence,
  };
}

function sanitizeStrengthScreenIds(
  strength: ScreenshotAnalysis["strengths"][number],
  validIds: Set<string>
): ScreenshotAnalysis["strengths"][number] | null {
  const screenIds = strength.screenIds.filter((id) => validIds.has(id));
  if (screenIds.length === 0) return null;
  return { ...strength, screenIds };
}

function limitIssuesByPriority(
  issues: ScreenshotAnalysisIssue[],
  metadata: ScreenshotReviewMetadata
): ScreenshotAnalysisIssue[] {
  return [...issues]
    .sort((a, b) => issuePriorityScore(b, metadata) - issuePriorityScore(a, metadata))
    .slice(0, MAX_ISSUES);
}

export function postprocessScreenshotAnalysis(
  analysis: ScreenshotAnalysis,
  metadata: ScreenshotReviewMetadata
): ScreenshotAnalysis {
  const validIds = new Set(metadata.screens.map((screen) => screen.id));

  const sanitizedIssues = analysis.issues
    .map((issue) => sanitizeIssueScreenIds(issue, validIds))
    .filter((issue): issue is ScreenshotAnalysisIssue => issue !== null);

  const deduplicatedIssues = deduplicateIssues(sanitizedIssues, metadata);
  const limitedIssues = limitIssuesByPriority(deduplicatedIssues, metadata);

  const strengths = analysis.strengths
    .map((strength) => sanitizeStrengthScreenIds(strength, validIds))
    .filter((strength): strength is ScreenshotAnalysis["strengths"][number] => strength !== null)
    .slice(0, 3);

  return {
    ...analysis,
    strengths,
    issues: limitedIssues,
    limitations: analysis.limitations.filter((item) => item.trim().length > 0),
  };
}
