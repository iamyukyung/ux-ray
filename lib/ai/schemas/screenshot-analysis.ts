import { z } from "zod/v3";

const nonEmptyString = z.string().trim().min(1);

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export const SeveritySchema = z.enum(["high", "medium", "low"]);
export const CategorySchema = z.enum([
  "visual-hierarchy",
  "navigation",
  "interaction",
  "consistency",
  "feedback",
  "error-prevention",
  "accessibility",
  "content",
  "flow",
]);

export const VisualEvidenceSchema = z.object({
  screenId: nonEmptyString,
  observation: nonEmptyString,
  confidence: ConfidenceSchema,
});

export const IssueSchema = z.object({
  id: nonEmptyString,
  severity: SeveritySchema,
  category: CategorySchema,
  title: nonEmptyString,
  description: nonEmptyString,
  evidence: z.array(VisualEvidenceSchema).min(1),
  screenIds: z.array(nonEmptyString).min(1),
  expectedImpact: nonEmptyString,
  recommendation: nonEmptyString,
});

export const StrengthSchema = z.object({
  title: nonEmptyString,
  description: nonEmptyString,
  screenIds: z.array(nonEmptyString).min(1),
});

export const ScreenshotAnalysisSchema = z.object({
  summary: nonEmptyString,
  overallConfidence: ConfidenceSchema,
  strengths: z.array(StrengthSchema).min(0).max(3),
  issues: z.array(IssueSchema).min(1).max(5),
  limitations: z.array(nonEmptyString),
});

export type ScreenshotAnalysis = z.infer<typeof ScreenshotAnalysisSchema>;
export type ScreenshotAnalysisIssue = z.infer<typeof IssueSchema>;
export type ScreenshotAnalysisStrength = z.infer<typeof StrengthSchema>;
export type ScreenshotAnalysisVisualEvidence = z.infer<typeof VisualEvidenceSchema>;
