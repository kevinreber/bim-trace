import type { Plugin } from "vite";
import { resolveApiKey, validateGenerateRequest } from "./aiConfig";
import {
  type GenerateRequest,
  HEARTBEAT_BYTE,
  HEARTBEAT_MS,
  runGeneration,
} from "./generate";

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

        const fail = (error: string, status: number) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error }));
        };

        let body: GenerateRequest;
        try {
          body = JSON.parse(await readBody(req)) as GenerateRequest;
        } catch {
          return fail("Request body is not valid JSON.", 400);
        }

        const apiKey = resolveApiKey(body.apiKey, process.env);
        if (!apiKey) {
          return fail(
            "No API key provided. Please enter your Anthropic API key.",
            400,
          );
        }
        const invalid = validateGenerateRequest(body);
        if (invalid) return fail(invalid, 400);

        // The dev server has no invocation timeout, so the heartbeat is not
        // needed here — but it is mirrored from the Vercel function on purpose.
        // Testing locally has to exercise the same response shape, or a bug in
        // the streamed path only ever shows up in production.
        const aborter = new AbortController();
        res.on("close", () => {
          // Fires on normal completion too, so only a close before the response
          // finished means the caller actually walked away.
          if (!res.writableFinished) aborter.abort();
        });

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        // Writing to a socket the caller has dropped emits an 'error' on the
        // response, which is unhandled by default and takes the dev server with
        // it. The callback absorbs it, and destroyed is checked first.
        const write = (chunk: string) => {
          if (res.destroyed || res.writableEnded) return;
          res.write(chunk, () => {});
        };
        write(HEARTBEAT_BYTE);
        const timer = setInterval(() => write(HEARTBEAT_BYTE), HEARTBEAT_MS);

        let payload: string;
        try {
          payload = JSON.stringify(
            await runGeneration(apiKey, body, aborter.signal),
          );
        } catch (err) {
          payload = JSON.stringify({
            error: err instanceof Error ? err.message : "Unknown server error",
          });
        }

        clearInterval(timer);
        if (!res.destroyed && !res.writableEnded) res.end(payload);
      });
    },
  };
}
