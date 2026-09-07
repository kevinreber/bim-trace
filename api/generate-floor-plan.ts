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
  // A generation runs for minutes, so a caller giving up partway through is an
  // ordinary event rather than an edge case. Aborting stops paying for a
  // response nobody will read.
  const aborter = new AbortController();
  req.signal?.addEventListener("abort", () => aborter.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      // Every write goes through this: once the consumer is gone the controller
      // throws, and an unguarded enqueue would reject inside `start`.
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false;
        }
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
      write(payload);
      if (open) controller.close();
    },
    cancel() {
      aborter.abort();
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
