import { z } from "zod/v3";
import { ConfidenceSchema } from "@/lib/ai/schemas/shared";

export const ScreenshotObservationSchema = z.object({
  screenId: z.string().min(1),
  pageUnderstanding: z.object({
    probablePageType: z.string().min(1),
    pageTypeConfidence: ConfidenceSchema,
    visiblePrimaryMessage: z.string().nullable(),
    visiblePrimaryActions: z.array(z.string()),
  }),
  sections: z.array(
    z.object({
      sectionId: z.string().min(1),
      cropIds: z.array(z.string()),
      locationLabel: z.string().min(1),
      visibleHeading: z.string().nullable(),
      purposeDescription: z.string().min(1),
      visibleActions: z.array(z.string()),
      visibleContentTypes: z.array(z.string()),
    })
  ),
  visibleTexts: z.array(
    z.object({
      text: z.string().min(1),
      cropId: z.string().min(1),
      confidence: ConfidenceSchema,
    })
  ),
  layoutPatterns: z.array(
    z.object({
      observation: z.string().min(1),
      cropIds: z.array(z.string()),
      confidence: ConfidenceSchema,
    })
  ),
  navigationObservations: z.array(
    z.object({
      observation: z.string().min(1),
      cropIds: z.array(z.string()),
      confidence: ConfidenceSchema,
    })
  ),
  ambiguousAreas: z.array(
    z.object({
      cropId: z.string().min(1),
      reason: z.string().min(1),
    })
  ),
});

export type ScreenshotObservation = z.infer<typeof ScreenshotObservationSchema>;
