import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "../server/prompt";

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

    const imageCount = body.images.length;
    const multiImageNote =
      imageCount > 1
        ? ` You have been provided ${imageCount} images of the same building from different angles/views. Cross-reference ALL images to get the most accurate and complete building model. Look for details visible in one image but not another (e.g., side windows, rear doors, upper floor layout).`
        : "";

    const userText = body.scaleHint
      ? `Analyze ${imageCount > 1 ? "these images" : "this image"} and generate BIM elements for the COMPLETE building (all floors, roof, stairs, structural elements) as a JSON array.${multiImageNote} Scale hint: ${body.scaleHint}. Use the thinking block for all your reasoning and analysis. Respond with ONLY the JSON array.`
      : `Analyze ${imageCount > 1 ? "these images" : "this image"} and generate BIM elements for the COMPLETE building (all floors, roof, stairs, structural elements) as a JSON array.${multiImageNote} Estimate reasonable dimensions in meters based on typical residential/commercial proportions. Use the thinking block for all your reasoning and analysis. Respond with ONLY the JSON array.`;

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

    const ALLOWED_MODELS = [
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
    ];
    const selectedModel = ALLOWED_MODELS.includes(body.model ?? "")
      ? body.model!
      : "claude-opus-4-20250514";
    const isOpus = selectedModel.includes("opus");

    const response = await client.messages.create({
      model: selectedModel,
      max_tokens: isOpus ? 64000 : 16000,
      thinking: {
        type: "enabled",
        budget_tokens: isOpus ? 40000 : 10000,
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    // Extract text from response (skip thinking blocks)
    const textBlock = response.content.find(
      (block) => block.type === "text",
    );
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response received from AI");
    }

    return new Response(JSON.stringify({ text: textBlock.text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
