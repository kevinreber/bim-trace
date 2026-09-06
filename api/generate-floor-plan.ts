import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "../server/prompt";
import {
  BIM_OUTPUT_SCHEMA,
  EFFORT,
  MAX_TOKENS,
  buildUserText,
  resolveModel,
  validateGenerateRequest,
} from "../server/aiConfig";

type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

interface ImageEntry {
  imageBase64: string;
  mediaType: ImageMediaType;
}

interface GenerateRequest {
  apiKey?: string;
  images: ImageEntry[];
  scaleHint?: string;
  model?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as GenerateRequest;

    const apiKey = body.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "No API key provided. Please enter your Anthropic API key.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const invalid = validateGenerateRequest(body);
    if (invalid) {
      return new Response(JSON.stringify({ error: invalid }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userText = buildUserText(body.images.length, body.scaleHint);

    const client = new Anthropic({ apiKey });

    // Build content array with all images
    const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];
    for (const { imageBase64, mediaType } of body.images) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: imageBase64,
        },
      });
    }
    content.push({ type: "text", text: userText });

    // Streamed: `budget_tokens` is rejected on Claude 5 models, and a 32k
    // ceiling on a non-streaming request risks an HTTP timeout.
    const response = await client.messages
      .stream({
        model: resolveModel(body.model),
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: {
          effort: EFFORT,
          format: { type: "json_schema", schema: BIM_OUTPUT_SCHEMA },
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      })
      .finalMessage();

    // Extract text from response (skip thinking blocks)
    const textBlock = response.content.find(
      (block) => block.type === "text",
    );
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response received from AI");
    }

    return new Response(
      JSON.stringify({
        text: textBlock.text,
        stopReason: response.stop_reason,
        usage: response.usage,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const config = {
  runtime: "edge",
};
