import { CaptureError } from "@/lib/capture-errors";
import { captureWebsite } from "@/lib/capture-server";
import type { CaptureProgressStep, CaptureStreamEvent } from "@/lib/capture-types";
import { normalizeCaptureUrl } from "@/lib/url-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function writeEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: CaptureStreamEvent
) {
  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

export async function POST(request: Request) {
  let body: { url?: string };

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "INVALID_URL", message: "요청 형식이 올바르지 않아요." },
      { status: 400 }
    );
  }

  const rawUrl = body.url?.trim();

  if (!rawUrl) {
    return Response.json(
      { error: "INVALID_URL", message: "분석할 URL을 입력해주세요." },
      { status: 400 }
    );
  }

  try {
    normalizeCaptureUrl(rawUrl);
  } catch (error) {
    if (error instanceof CaptureError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return Response.json(
      { error: "INVALID_URL", message: "올바른 URL을 입력해주세요." },
      { status: 400 }
    );
  }

  const accept = request.headers.get("accept") ?? "";
  const wantsStream = accept.includes("application/x-ndjson");

  if (!wantsStream) {
    try {
      const result = await captureWebsite(rawUrl);
      return Response.json(result);
    } catch (error) {
      if (error instanceof CaptureError) {
        return Response.json({ error: error.code, message: error.message }, { status: error.status });
      }
      return Response.json(
        { error: "CAPTURE_FAILED", message: "페이지 캡처 중 오류가 발생했어요." },
        { status: 500 }
      );
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await captureWebsite(rawUrl, (step: CaptureProgressStep) => {
          writeEvent(controller, encoder, { type: "progress", step });
        });

        writeEvent(controller, encoder, { type: "result", ...result });
        controller.close();
      } catch (error) {
        const payload =
          error instanceof CaptureError
            ? { error: error.code, message: error.message }
            : { error: "CAPTURE_FAILED", message: "페이지 캡처 중 오류가 발생했어요." };

        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
