import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod/v3";
import type { AiModelConfig, ReasoningEffort } from "@/lib/ai/config";

export function createOpenAIClient(timeoutMs: number): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return new OpenAI({ apiKey, timeout: Math.max(5_000, timeoutMs) });
}

export function hasRefusalOutput(response: OpenAI.Responses.Response): boolean {
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "refusal") return true;
    }
  }
  return false;
}

function reasoningConfig(effort: ReasoningEffort): OpenAI.Responses.ResponseCreateParams["reasoning"] {
  return { effort };
}

export async function callStructuredOutput<T extends z.ZodTypeAny>(options: {
  client: OpenAI;
  model: string;
  instructions: string;
  input: OpenAI.Responses.ResponseCreateParams["input"];
  schema: T;
  schemaName: string;
  reasoningEffort: ReasoningEffort;
  signal?: AbortSignal;
  requestTimeoutMs?: number;
}): Promise<z.infer<T> | null> {
  if (options.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const response = await options.client.responses.parse(
    {
      model: options.model,
      instructions: options.instructions,
      input: options.input,
      store: false,
      reasoning: reasoningConfig(options.reasoningEffort),
      text: {
        format: zodTextFormat(options.schema, options.schemaName),
      },
    },
    {
      signal: options.signal,
      timeout: options.requestTimeoutMs,
    }
  );

  if (hasRefusalOutput(response)) {
    return null;
  }

  return response.output_parsed as z.infer<T> | null;
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

type OpenAIInputContent =
  | { type: "input_text"; text: string }
  | {
      type: "input_image";
      image_url: string;
      detail: "low" | "high" | "original" | "auto";
    };

export function textPart(text: string): OpenAIInputContent {
  return { type: "input_text", text };
}

export function imagePart(
  buffer: Buffer,
  mimeType: string,
  detail: "low" | "high" | "original" | "auto",
  label?: string
): OpenAIInputContent[] {
  const parts: OpenAIInputContent[] = [];
  if (label) {
    parts.push(textPart(label));
  }
  parts.push({
    type: "input_image",
    image_url: bufferToDataUrl(buffer, mimeType),
    detail,
  });
  return parts;
}

export type { AiModelConfig };
