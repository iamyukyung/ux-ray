import { toClientErrorBody } from "@/lib/ai/pipeline/pipeline-stage";
import { getScreenshotReviewJob } from "@/lib/ai/pipeline/screenshot-review-job-store";
import { isCompletePipelineReport } from "@/lib/ai/pipeline/report-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: { reviewId: string } }
): Promise<Response> {
  const job = getScreenshotReviewJob(params.reviewId);

  if (!job) {
    return Response.json(
      { status: "not-found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (job.status === "processing") {
    return Response.json(
      { status: "processing", stepIndex: job.stepIndex },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (job.status === "error") {
    const clientError = job.error
      ? toClientErrorBody(job.error, job.error.stage)
      : { code: "INTERNAL_ERROR" as const, message: "AI 리뷰를 만들지 못했어요. 잠시 후 다시 시도해주세요." };

    return Response.json(
      { status: "error", error: clientError },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // status === "done"
  if (!job.result || !isCompletePipelineReport(job.result.report)) {
    return Response.json(
      {
        status: "error",
        error: {
          code: "INVALID_AI_RESPONSE",
          message: "AI 분석 결과를 해석하지 못했어요. 잠시 후 다시 시도해주세요.",
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const body =
    process.env.NODE_ENV === "development"
      ? { status: "done", report: job.result.report, _debug: job.result.debug }
      : { status: "done", report: job.result.report };

  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
