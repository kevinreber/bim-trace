import {
  resolveApiKey,
  validateGenerateRequest,
} from "../server/aiConfig";
import {
  type GenerateRequest,
  HEARTBEAT_BYTE,
  HEARTBEAT_MS,
  runGeneration,
} from "../server/generate";

const JSON_HEADERS = { "Content-Type": "application/json" };

function fail(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: JSON_HEADERS,
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return fail("Method not allowed", 405);

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return fail("Request body is not valid JSON.", 400);
  }

  // Everything cheap is answered with a real status code before the response is
  // committed. Only the generation itself has to stream, so a malformed request
  // still gets a 400 rather than a 200 carrying an error.
  const apiKey = resolveApiKey(body.apiKey, process.env);
  if (!apiKey) {
    return fail("No API key provided. Please enter your Anthropic API key.", 400);
  }
  const invalid = validateGenerateRequest(body);
  if (invalid) return fail(invalid, 400);

  // Past this point the status is committed to 200 before the outcome is known,
  // because the platform kills a function that has not started responding. A
  // failure is therefore reported in the body as `{ "error": ... }`, which the
  // client checks regardless of status.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const beat = () => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(HEARTBEAT_BYTE));
        } catch {
          open = false;
        }
      };
      beat();
      const timer = setInterval(beat, HEARTBEAT_MS);

      let payload: string;
      try {
        payload = JSON.stringify(await runGeneration(apiKey, body));
      } catch (err) {
        payload = JSON.stringify({
          error: err instanceof Error ? err.message : "Unknown server error",
        });
      }

      clearInterval(timer);
      open = false;
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...JSON_HEADERS,
      "Cache-Control": "no-store",
      // Discourage any intermediary from buffering the heartbeat away, which
      // would defeat the point of sending it.
      "X-Accel-Buffering": "no",
    },
  });
}

export const config = {
  runtime: "edge",
};
