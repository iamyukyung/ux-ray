import { GENERIC_PHRASES } from "@/lib/ai/postprocess-pipeline-draft";
import type { ScreenshotReviewReport } from "@/lib/types";

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

function countDuplicateIssues(report: ScreenshotReviewReport): number {
  let duplicates = 0;
  const titles = report.issues.map((issue) => issue.title);

  for (let i = 0; i < titles.length; i += 1) {
    for (let j = i + 1; j < titles.length; j += 1) {
      if (jaccardSimilarity(titles[i]!, titles[j]!) >= 0.55) {
        duplicates += 1;
      }
    }
  }

  return duplicates;
}

function countGenericIssues(report: ScreenshotReviewReport): number {
  return report.issues.filter((issue) => {
    const combined = `${issue.title} ${issue.description} ${issue.recommendation}`;
    const normalized = normalizeText(combined);
    return GENERIC_PHRASES.some((phrase) => normalized.includes(phrase));
  }).length;
}

function countEvidenceWithCrop(report: ScreenshotReviewReport): number {
  let total = 0;
  let withCrop = 0;

  for (const issue of report.issues) {
    for (const item of issue.evidence) {
      if (typeof item === "string") {
        total += 1;
        continue;
      }
      total += 1;
      if (item.cropId) withCrop += 1;
    }
  }

  return total === 0 ? 0 : withCrop / total;
}

export interface PipelineCompareMetrics {
  pipelineVersion: string;
  durationMs: number;
  specificEvidenceCount: number;
  uniqueIssueTitleRatio: number;
  duplicateIssueCount: number;
  cropEvidenceRatio: number;
  genericPhraseRatio: number;
  qualityScores?: {
    specificity: number;
    evidenceQuality: number;
    actionability: number;
    prioritization: number;
    nonHallucination: number;
  };
  issueCount: number;
  executiveSummaryPreview: string;
  issueTitles: string[];
}

export function measurePipelineReport(
  report: ScreenshotReviewReport,
  durationMs: number
): PipelineCompareMetrics {
  const issueTitles = report.issues.map((issue) => issue.title);
  const uniqueTitles = new Set(issueTitles.map(normalizeText));

  let specificEvidenceCount = 0;
  for (const issue of report.issues) {
    for (const item of issue.evidence) {
      if (typeof item === "string") continue;
      if (item.observation.length >= 20) specificEvidenceCount += 1;
    }
  }

  return {
    pipelineVersion: report.pipelineVersion ?? "1.0",
    durationMs,
    specificEvidenceCount,
    uniqueIssueTitleRatio:
      issueTitles.length === 0 ? 0 : uniqueTitles.size / issueTitles.length,
    duplicateIssueCount: countDuplicateIssues(report),
    cropEvidenceRatio: countEvidenceWithCrop(report),
    genericPhraseRatio:
      report.issues.length === 0 ? 0 : countGenericIssues(report) / report.issues.length,
    qualityScores: report.quality
      ? {
          specificity: report.quality.specificity,
          evidenceQuality: report.quality.evidenceQuality,
          actionability: report.quality.actionability,
          prioritization: report.quality.prioritization,
          nonHallucination: report.quality.nonHallucination,
        }
      : undefined,
    issueCount: report.issues.length,
    executiveSummaryPreview: (report.executiveSummary ?? report.insight.summary).slice(0, 120),
    issueTitles,
  };
}

export const PIPELINE_COMPARE_TEST_CASES = [
  { id: "A", label: "기업 홈페이지 전체 페이지" },
  { id: "B", label: "로그인 또는 회원가입 화면" },
  { id: "C", label: "상품·게임 목록 화면" },
  { id: "D", label: "입력 폼이 포함된 화면" },
] as const;
