import type { Plugin } from "vite";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt";

type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

interface ImageEntry {
  imageBase64: string;
  mediaType: ImageMediaType;
}

interface GenerateRequest {
  apiKey?: string;
  images: ImageEntry[];
  scaleHint?: string;
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

          const response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 16000,
            thinking: {
              type: "enabled",
              budget_tokens: 10000,
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

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ text: textBlock.text }));
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
