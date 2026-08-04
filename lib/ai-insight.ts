import type { AiInsight, ReviewReport } from "./types";

const DEFAULT_CONFIDENCE = 85;

function clampConfidence(value: number): number {
  return Math.min(98, Math.max(70, Math.round(value)));
}

/** overallScore 기반 Mock confidence (70~98, 100% 미사용) */
function confidenceFromScore(score: number): number {
  return clampConfidence(72 + Math.round(score * 0.26));
}

/**
 * aiInsight가 없거나 일부 필드만 있는 리포트에서도
 * AI Insight UI가 안전하게 렌더링되도록 기본값을 반환합니다.
 */
export function resolveAiInsight(report: ReviewReport): AiInsight {
  const insight = report.aiInsight;

  if (insight?.summary && Array.isArray(insight.evidence)) {
    return {
      summary: insight.summary,
      confidence: clampConfidence(insight.confidence ?? DEFAULT_CONFIDENCE),
      evidence: insight.evidence,
    };
  }

  if (insight?.summary) {
    return {
      summary: insight.summary,
      confidence: clampConfidence(insight.confidence ?? DEFAULT_CONFIDENCE),
      evidence: insight.evidence ?? [],
    };
  }

  return {
    summary: report.overallSummary,
    confidence: clampConfidence(insight?.confidence ?? confidenceFromScore(report.overallScore)),
    evidence: insight?.evidence ?? [],
  };
}
