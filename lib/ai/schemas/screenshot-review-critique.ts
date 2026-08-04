import { z } from "zod/v3";

export const ScreenshotReviewCritiqueSchema = z.object({
  scores: z.object({
    specificity: z.number().int().min(1).max(5),
    evidenceQuality: z.number().int().min(1).max(5),
    actionability: z.number().int().min(1).max(5),
    prioritization: z.number().int().min(1).max(5),
    nonHallucination: z.number().int().min(1).max(5),
  }),
  approved: z.boolean(),
  problems: z.array(
    z.object({
      issueId: z.string().nullable(),
      type: z.string().min(1),
      description: z.string().min(1),
    })
  ),
  missingHighValueFindings: z.array(z.string()),
  rewriteInstructions: z.array(z.string()),
});

export type ScreenshotReviewCritique = z.infer<typeof ScreenshotReviewCritiqueSchema>;

export function isCritiqueApproved(critique: ScreenshotReviewCritique): boolean {
  const { scores, approved } = critique;
  if (!approved) return false;

  const allAboveThree =
    scores.specificity >= 3 &&
    scores.evidenceQuality >= 3 &&
    scores.actionability >= 3 &&
    scores.prioritization >= 3 &&
    scores.nonHallucination >= 3;

  return allAboveThree && scores.evidenceQuality >= 4 && scores.nonHallucination >= 4;
}
