import Anthropic from "@anthropic-ai/sdk";
import {
  BIM_OUTPUT_SCHEMA,
  EFFORT,
  MAX_TOKENS,
  buildUserText,
  resolveModel,
} from "./aiConfig";
import { SYSTEM_PROMPT } from "./prompt";

export type ImageMediaType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/gif";

export interface ImageEntry {
  imageBase64: string;
  mediaType: ImageMediaType;
}

export interface GenerateRequest {
  apiKey?: string;
  images: ImageEntry[];
  scaleHint?: string;
  model?: string;
}

export interface GenerateResult {
  text: string;
  stopReason: string | null;
  usage: unknown;
}

/**
 * How often to emit a keep-alive byte while the model is working.
 *
 * Vercel terminates an edge function that has not begun responding within about
 * 25 seconds, and a generation at effort "high" runs for two to four minutes. A
 * handler that awaits the whole message before returning therefore never
 * responds at all: the platform substitutes its own plain-text error page, which
 * the client then fails to parse as JSON.
 *
 * The heartbeat is a single space. Whitespace is legal JSON ahead of the value,
 * so the payload stays a plain JSON document and callers can keep using
 * `response.json()` with no envelope to unwrap.
 */
export const HEARTBEAT_MS = 5000;
export const HEARTBEAT_BYTE = " ";

/**
 * Runs one generation against the Anthropic API.
 *
 * Shared by the Vite dev proxy and the Vercel function so the two cannot drift
 * in what they send — the same reason the model list and output schema live in
 * `aiConfig.ts`.
 */
export async function runGeneration(
  apiKey: string,
  body: GenerateRequest,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const userText = buildUserText(body.images.length, body.scaleHint);
  const client = new Anthropic({ apiKey });

  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];
  for (const { imageBase64, mediaType } of body.images) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: imageBase64 },
    });
  }
  content.push({ type: "text", text: userText });

  // Streamed from the API because `budget_tokens` is rejected on Claude 5 and a
  // 32k ceiling on a non-streaming request risks an HTTP timeout. Note this is
  // the upstream leg only; the heartbeat above is what keeps the downstream leg
  // to the browser alive.
  // The signal matters here because a generation costs real credits and runs for
  // minutes: without it, a caller who closes the tab keeps the upstream request
  // alive and pays for a response nobody will read.
  const message = await client.messages
    .stream(
      {
        model: resolveModel(body.model),
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: {
          effort: EFFORT,
          format: { type: "json_schema", schema: BIM_OUTPUT_SCHEMA },
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      },
      { signal },
    )
    .finalMessage();

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response received from AI");
  }

  return {
    text: textBlock.text,
    stopReason: message.stop_reason,
    usage: message.usage,
  };
}
