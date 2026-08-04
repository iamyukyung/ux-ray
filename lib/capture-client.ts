import type {
  CaptureErrorResponse,
  CaptureProgressStep,
  CaptureResult,
  CaptureStreamEvent,
} from "./capture-types";

const STEP_ORDER: CaptureProgressStep[] = [
  "connect",
  "desktop-screenshot",
  "mobile-screenshot",
  "structure",
  "demo-report",
];

export function captureStepIndex(step: CaptureProgressStep): number {
  const index = STEP_ORDER.indexOf(step);
  return index >= 0 ? index : 0;
}

export class CaptureRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CaptureRequestError";
    this.code = code;
  }
}

function isErrorPayload(value: unknown): value is CaptureErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    "message" in value &&
    typeof (value as CaptureErrorResponse).error === "string"
  );
}

function isResultPayload(value: unknown): value is CaptureStreamEvent & CaptureResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type: string }).type === "result"
  );
}

export async function requestCapture(
  url: string,
  onProgress?: (step: CaptureProgressStep) => void
): Promise<CaptureResult> {
  const response = await fetch("/api/capture", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify({ url }),
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-ndjson")) {
    if (!response.body) {
      throw new CaptureRequestError("CAPTURE_FAILED", "캡처 응답을 읽을 수 없어요.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: CaptureResult | undefined;
    let errorPayload: CaptureErrorResponse | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;

        const parsed = JSON.parse(line) as unknown;

        if (isErrorPayload(parsed)) {
          errorPayload = parsed;
          continue;
        }

        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "type" in parsed &&
          (parsed as { type: string }).type === "progress" &&
          "step" in parsed
        ) {
          onProgress?.((parsed as { step: CaptureProgressStep }).step);
          continue;
        }

        if (isResultPayload(parsed)) {
          result = {
            normalizedUrl: parsed.normalizedUrl,
            title: parsed.title,
            desktopScreenshot: parsed.desktopScreenshot,
            mobileScreenshot: parsed.mobileScreenshot,
            pageData: parsed.pageData,
          };
        }
      }
    }

    if (buffer.trim()) {
      const parsed = JSON.parse(buffer) as unknown;
      if (isErrorPayload(parsed)) errorPayload = parsed;
      if (isResultPayload(parsed)) {
        result = {
          normalizedUrl: parsed.normalizedUrl,
          title: parsed.title,
          desktopScreenshot: parsed.desktopScreenshot,
          mobileScreenshot: parsed.mobileScreenshot,
          pageData: parsed.pageData,
        };
      }
    }

    if (errorPayload) {
      throw new CaptureRequestError(errorPayload.error, errorPayload.message);
    }

    if (result) return result;

    throw new CaptureRequestError("CAPTURE_FAILED", "캡처 결과를 받지 못했어요.");
  }

  const payload = (await response.json()) as CaptureResult | CaptureErrorResponse;

  if (!response.ok || isErrorPayload(payload)) {
    const error = isErrorPayload(payload)
      ? payload
      : { error: "CAPTURE_FAILED", message: "페이지 캡처에 실패했어요." };
    throw new CaptureRequestError(error.error, error.message);
  }

  onProgress?.("connect");
  onProgress?.("desktop-screenshot");
  onProgress?.("mobile-screenshot");
  onProgress?.("structure");

  return payload;
}

export { STEP_ORDER as CAPTURE_STEP_ORDER };
