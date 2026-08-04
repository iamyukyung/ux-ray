import { randomUUID } from "node:crypto";
import { getScreenshotReviewTimeoutMs } from "@/lib/ai/config";
import { createPipelineDeadlineContext } from "@/lib/ai/pipeline/pipeline-timeout";
import { measurePipelineReport } from "@/lib/ai/pipeline/pipeline-compare";
import { runScreenshotPipelineV2 } from "@/lib/ai/pipeline/run-screenshot-pipeline-v2";
import {
  analyzeScreenshotsWithOpenAI_v1,
  parseScreenshotReviewRequest,
} from "@/lib/ai/screenshot-review-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Max env timeout (600s) + 15s buffer — must be a route-local literal for Next.js. */
export const maxDuration = 615;

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 404 });
  }

  const requestId = randomUUID();

  try {
    const formData = await request.formData();
    const parsed = await parseScreenshotReviewRequest(formData);

    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const v1Started = Date.now();
    const v1Result = await analyzeScreenshotsWithOpenAI_v1(parsed.value, `${requestId}-v1`);
    const v1Duration = Date.now() - v1Started;

    if (!v1Result.ok) {
      return Response.json(
        { error: v1Result.error, requestId, pipeline: "v1" },
        { status: 502 }
      );
    }

    const v2Started = Date.now();
    const deadline = createPipelineDeadlineContext(getScreenshotReviewTimeoutMs());
    let v2Result;
    try {
      v2Result = await runScreenshotPipelineV2(parsed.value, `${requestId}-v2`, deadline);
    } finally {
      deadline.cleanup();
    }
    const v2Duration = Date.now() - v2Started;

    if (!v2Result.ok) {
      return Response.json(
        { error: v2Result.error, requestId, pipeline: "v2", v1: measurePipelineReport(v1Result.result.report, v1Duration) },
        { status: 502 }
      );
    }

    const v1Metrics = measurePipelineReport(v1Result.result.report, v1Duration);
    const v2Metrics = measurePipelineReport(v2Result.result.report, v2Duration);

    const substantiallyDifferent =
      v1Metrics.executiveSummaryPreview !== v2Metrics.executiveSummaryPreview ||
      v1Metrics.issueTitles.join("|") !== v2Metrics.issueTitles.join("|");

    return Response.json(
      {
        requestId,
        substantiallyDifferent,
        v1: v1Metrics,
        v2: v2Metrics,
        comparison: {
          evidenceGain: v2Metrics.specificEvidenceCount - v1Metrics.specificEvidenceCount,
          duplicateReduction: v1Metrics.duplicateIssueCount - v2Metrics.duplicateIssueCount,
          genericReduction: v1Metrics.genericPhraseRatio - v2Metrics.genericPhraseRatio,
          cropEvidenceGain: v2Metrics.cropEvidenceRatio - v1Metrics.cropEvidenceRatio,
          durationDeltaMs: v2Metrics.durationMs - v1Metrics.durationMs,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json({ error: "Comparison failed", requestId }, { status: 500 });
  }
}
