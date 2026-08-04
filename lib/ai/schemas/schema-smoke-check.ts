import { zodTextFormat } from "openai/helpers/zod";
import { ScreenshotReviewCritiqueSchema } from "@/lib/ai/schemas/screenshot-review-critique";
import { ScreenshotReviewDraftSchema } from "@/lib/ai/schemas/screenshot-review-draft";
import { ScreenshotObservationSchema } from "@/lib/ai/schemas/screenshot-observation";

const PIPELINE_SCHEMA_CHECKS = [
  {
    key: "observer" as const,
    schema: ScreenshotObservationSchema,
    name: "screenshot_observation",
  },
  {
    key: "reviewer" as const,
    schema: ScreenshotReviewDraftSchema,
    name: "screenshot_review_draft",
  },
  {
    key: "critic" as const,
    schema: ScreenshotReviewCritiqueSchema,
    name: "screenshot_review_critique",
  },
];

export function runOpenAiSchemaSmokeCheck(): void {
  if (process.env.NODE_ENV !== "development") return;

  const result: Record<(typeof PIPELINE_SCHEMA_CHECKS)[number]["key"], string> = {
    observer: "ok",
    reviewer: "ok",
    critic: "ok",
  };

  for (const check of PIPELINE_SCHEMA_CHECKS) {
    try {
      zodTextFormat(check.schema, check.name);
    } catch (error) {
      result[check.key] =
        error instanceof Error ? `${check.key}: ${error.message}` : `${check.key}: Unknown error`;
    }
  }

  console.info("[screenshot-review:schema]", result);
}
