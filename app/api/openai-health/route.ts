import OpenAI, {
  APIError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  RateLimitError,
} from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_OUTPUT = "UX-RAY-API-OK";
const PROMPT = `Respond with exactly: ${EXPECTED_OUTPUT}`;

type HealthSuccess = {
  ok: true;
  message: string;
  model: string;
};

type HealthFailure = {
  ok: false;
  code: "AUTH_ERROR" | "BILLING_OR_LIMIT_ERROR" | "MODEL_ERROR" | "API_ERROR";
  message: string;
};

function jsonResponse(body: HealthSuccess | HealthFailure, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isBillingOrLimitError(error: APIError): boolean {
  const nested = error.error as { code?: string; type?: string } | undefined;
  const code = nested?.code ?? error.code ?? "";
  const type = nested?.type ?? error.type ?? "";

  return (
    error.status === 402 ||
    error.status === 429 ||
    code === "insufficient_quota" ||
    code === "billing_hard_limit_reached" ||
    type === "insufficient_quota"
  );
}

function isModelError(error: APIError): boolean {
  const nested = error.error as { code?: string } | undefined;
  const code = nested?.code ?? error.code ?? "";

  return (
    error instanceof NotFoundError ||
    error.param === "model" ||
    code === "model_not_found" ||
    code === "model_not_available"
  );
}

function classifyOpenAIError(error: unknown): HealthFailure {
  if (error instanceof AuthenticationError) {
    return {
      ok: false,
      code: "AUTH_ERROR",
      message: "API 키를 확인해주세요.",
    };
  }

  if (error instanceof RateLimitError) {
    return {
      ok: false,
      code: "BILLING_OR_LIMIT_ERROR",
      message: "API 결제 설정과 사용 한도를 확인해주세요.",
    };
  }

  if (error instanceof APIError) {
    if (isBillingOrLimitError(error)) {
      return {
        ok: false,
        code: "BILLING_OR_LIMIT_ERROR",
        message: "API 결제 설정과 사용 한도를 확인해주세요.",
      };
    }

    if (isModelError(error) || (error instanceof BadRequestError && error.param === "model")) {
      return {
        ok: false,
        code: "MODEL_ERROR",
        message: "설정한 모델을 사용할 수 없습니다.",
      };
    }
  }

  return {
    ok: false,
    code: "API_ERROR",
    message: "OpenAI API 연결을 확인하지 못했습니다.",
  };
}

export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return jsonResponse(
      {
        ok: false,
        code: "AUTH_ERROR",
        message: "API 키를 확인해주세요.",
      },
      503
    );
  }

  const model = process.env.OPENAI_VISION_MODEL || "gpt-5.6-terra";

  try {
    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model,
      input: PROMPT,
    });

    const outputText = response.output_text ?? "";

    if (!outputText.includes(EXPECTED_OUTPUT)) {
      return jsonResponse(
        {
          ok: false,
          code: "API_ERROR",
          message: "OpenAI API 연결을 확인하지 못했습니다.",
        },
        502
      );
    }

    return jsonResponse({
      ok: true,
      message: "OpenAI API 연결이 정상입니다.",
      model,
    });
  } catch (error) {
    const failure = classifyOpenAIError(error);
    const status =
      failure.code === "AUTH_ERROR" ? 401
      : failure.code === "BILLING_OR_LIMIT_ERROR" ? 429
      : failure.code === "MODEL_ERROR" ? 400
      : 502;

    return jsonResponse(failure, status);
  }
}
