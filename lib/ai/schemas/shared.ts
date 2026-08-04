import { z } from "zod/v3";

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ReviewAssumptionSchema = z.object({
  statement: z.string().min(1),
  confidence: ConfidenceSchema,
  basis: z.string().min(1),
});

export type ReviewAssumption = z.infer<typeof ReviewAssumptionSchema>;

export const VisualEvidenceSchema = z.object({
  screenId: z.string().min(1),
  cropId: z.string().min(1),
  locationLabel: z.string().min(1),
  observation: z.string().min(1),
  confidence: ConfidenceSchema,
});

export type VisualEvidence = z.infer<typeof VisualEvidenceSchema>;

export const ScreenshotIssueCategorySchema = z.enum([
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

export type ScreenshotIssueCategory = z.infer<typeof ScreenshotIssueCategorySchema>;
