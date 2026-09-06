import type { Plugin } from "vite";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt";
import {
  BIM_OUTPUT_SCHEMA,
  EFFORT,
  MAX_TOKENS,
  buildUserText,
  resolveModel,
} from "./aiConfig";

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

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

export function apiProxyPlugin(): Plugin {
  return {
    name: "api-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "POST" || req.url !== "/api/generate-floor-plan") {
          return next();
        }

        try {
          const body = JSON.parse(await readBody(req)) as GenerateRequest;

          const apiKey = body.apiKey || process.env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error:
                  "No API key provided. Please enter your Anthropic API key.",
              }),
            );
            return;
          }

          const userText = buildUserText(body.images.length, body.scaleHint);

          const client = new Anthropic({ apiKey });

          // Build content array with all images
          const content: Anthropic.MessageCreateParams["messages"][0]["content"] =
            [];
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

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              text: textBlock.text,
              stopReason: response.stop_reason,
              usage: response.usage,
            }),
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown server error";
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}
