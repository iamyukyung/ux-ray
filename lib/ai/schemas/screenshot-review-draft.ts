import { z } from "zod/v3";
import {
  NormanPrincipleSchema,
  ReviewAssumptionSchema,
  ScreenshotIssueCategorySchema,
  VisualEvidenceSchema,
} from "@/lib/ai/schemas/shared";

export const ScreenshotReviewDraftSchema = z.object({
  pageSummary: z.object({
    probablePurpose: z.string().min(1),
    contentNarrative: z.string().min(1),
    primaryAudiences: z.array(z.string()),
    assumptions: z.array(ReviewAssumptionSchema),
  }),
  executiveSummary: z.string().min(1),
  strengths: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().min(1),
        evidence: z.array(VisualEvidenceSchema).min(1).max(4),
      })
    )
    .max(4),
  issues: z
    .array(
      z.object({
        id: z.string().min(1),
        severity: z.enum(["high", "medium", "low"]),
        category: ScreenshotIssueCategorySchema,
        title: z.string().min(1),
        description: z.string().min(1),
        evidence: z.array(VisualEvidenceSchema).min(1),
        expectedImpact: z.string().min(1),
        recommendation: z.string().min(1),
        validationMethod: z.string().min(1),
        principle: NormanPrincipleSchema.nullable(),
      })
    )
    .min(1)
    .max(6),
  limitations: z.array(z.string()),
});

export type ScreenshotReviewDraft = z.infer<typeof ScreenshotReviewDraftSchema>;
