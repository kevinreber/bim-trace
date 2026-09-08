/**
 * Shared request configuration for the floor-plan generation endpoint.
 *
 * Both the Vite dev proxy (`server/apiProxy.ts`) and the Vercel edge function
 * (`api/generate-floor-plan.ts`) build the same request. Keeping the model list,
 * output schema, and user text here stops the two paths from drifting.
 */

export const ALLOWED_MODELS = ["claude-opus-5", "claude-sonnet-5"] as const;

export type AllowedModel = (typeof ALLOWED_MODELS)[number];

export const DEFAULT_MODEL: AllowedModel = "claude-opus-5";

export const AI_MODEL_OPTIONS: { id: AllowedModel; label: string }[] = [
  { id: "claude-opus-5", label: "Claude Opus 5" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
];

/** Streamed, so a large ceiling does not risk an HTTP timeout. */
export const MAX_TOKENS = 32000;

/**
 * Reasoning effort. Measured generations take roughly 2-3 minutes at "high";
 * drop to "medium" if interactive latency matters more than accuracy.
 */
export const EFFORT = "high" as const;

export function resolveModel(requested: string | undefined): string {
  return (ALLOWED_MODELS as readonly string[]).includes(requested ?? "")
    ? (requested as string)
    : DEFAULT_MODEL;
}

/**
 * Upper bound on images per request. The modal caps uploads at 5, but the
 * endpoint is reachable directly, and each image is billed input on whichever
 * key ends up paying — the caller's, or `ANTHROPIC_API_KEY` if the deployment
 * sets one. Without a cap, one request can carry an arbitrary number.
 */
export const MAX_IMAGES = 5;

/**
 * Picks the key that will pay for the request.
 *
 * The endpoint has no authentication, which is fine under BYOK because every
 * caller spends their own credits. The `ANTHROPIC_API_KEY` fallback breaks that
 * property: in production it turns an open endpoint into a paid one that anyone
 * who finds the URL can drive, at roughly $0.85 a request. So the fallback is a
 * local convenience only, unless a deployment opts in explicitly by setting
 * `ALLOW_SHARED_API_KEY=true` — which should only be done behind access control.
 */
export function resolveApiKey(
  userKey: string | undefined,
  env: Record<string, string | undefined>,
): string | undefined {
  if (userKey) return userKey;
  const isProduction =
    env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
  if (isProduction && env.ALLOW_SHARED_API_KEY !== "true") return undefined;
  return env.ANTHROPIC_API_KEY;
}

/**
 * Image formats the Anthropic API accepts. Exported because the upload UI must
 * gate on the same list the endpoint enforces — when the two drifted, the modal
 * accepted any `image/*` file and a HEIC photo from an iPhone was only rejected
 * after the upload, by the server, in terms the user had no way to act on.
 */
export const ALLOWED_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** The same list as UI copy, derived so it cannot fall out of step. */
export const ALLOWED_FORMATS_LABEL = ALLOWED_MEDIA_TYPES.map((t) =>
  t.replace("image/", "").toUpperCase(),
).join(", ");

/**
 * Validates the request body, returning an error string or null.
 *
 * Both proxies read `body.images.length` before anything else, so a body
 * without `images` threw a TypeError and surfaced as a 500 carrying a raw
 * JavaScript message. A malformed request is the caller's error and should
 * say so.
 */
export function validateGenerateRequest(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Request body must be an object.";
  const { images } = body as { images?: unknown };
  if (!Array.isArray(images) || images.length === 0) {
    return "Request must include a non-empty `images` array.";
  }
  if (images.length > MAX_IMAGES) {
    return `Too many images: ${images.length}. The maximum is ${MAX_IMAGES}.`;
  }
  for (const image of images) {
    if (!image || typeof image !== "object") {
      return "Each image must be an object with `imageBase64` and `mediaType`.";
    }
    const { imageBase64, mediaType } = image as {
      imageBase64?: unknown;
      mediaType?: unknown;
    };
    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return "Each image must carry a non-empty `imageBase64` string.";
    }
    if (
      typeof mediaType !== "string" ||
      !(ALLOWED_MEDIA_TYPES as readonly string[]).includes(mediaType)
    ) {
      return `Unsupported mediaType. Allowed: ${ALLOWED_MEDIA_TYPES.join(", ")}.`;
    }
  }
  return null;
}

// The API rejects `minimum`/`maximum` on numeric schemas, so values cannot be
// bounded here. The one lever available is `integer`, which narrows the number
// grammar enough to block the runaway-literal failure observed on numRisers
// ("numRisers":16.00000000000000041e-1100000...), where constrained decoding
// fell into an unbounded decimal and consumed the entire token budget.
// salvageTruncatedElements in aiFloorPlanService is the backstop for the rest.
const COORD = { type: "number" };
const DIM = { type: "number" };

const POINT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["x", "z"],
  properties: { x: COORD, z: COORD },
};

/**
 * Structured-output schema for the generated building.
 *
 * `params` enumerates the union of every element type's fields rather than a
 * per-type union: the API requires `additionalProperties: false` on object
 * schemas, so a free-form numeric map is rejected. `validateAndFixElements`
 * already coerces each type's fields against DEFAULT_PARAMS, so extra or
 * missing keys for a given type are harmless.
 */
export const BIM_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["elements"],
  properties: {
    elements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "type",
          "name",
          "start",
          "end",
          "params",
          "level",
          "rotation",
          "hostWallId",
          "material",
        ],
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: [
              "wall",
              "door",
              "window",
              "column",
              "slab",
              "roof",
              "stair",
              "ceiling",
              "beam",
              // Both have had builders, params, and materials in the app all
              // along; leaving them out of the enum meant a balcony came back
              // as columns and a glazed gable as ordinary windows, because
              // those were the closest shapes the model was allowed to name.
              "railing",
              "curtainWall",
            ],
          },
          name: { type: "string" },
          start: POINT_SCHEMA,
          end: POINT_SCHEMA,
          level: { type: "number" },
          // Null for everything except doors, windows, and roofs, where it
          // sets the ridge direction.
          rotation: { type: ["number", "null"] },
          hostWallId: { type: ["string", "null"] },
          // Without this every element fell back to its type default, so a
          // dark tiled roof and a timber-clad gable both rendered in the same
          // stock brown.
          //
          // "unknown" rather than null carries "use the type default". A null
          // inside an enum, or an enum on a nullable type, is a construct this
          // schema has never used and the API's acceptance of it cannot be
          // tested without spending a real generation — and a schema the API
          // rejects breaks every request, not just an edge case. This sticks to
          // the plain string enum already proven by the `type` property above.
          material: {
            type: "string",
            enum: [
              "concrete",
              "wood",
              "steel",
              "glass",
              "brick",
              "stone",
              "drywall",
              "aluminum",
              "unknown",
            ],
          },
          params: {
            type: "object",
            additionalProperties: false,
            properties: {
              height: DIM,
              thickness: DIM,
              width: DIM,
              radius: DIM,
              sillHeight: DIM,
              overhang: DIM,
              riserHeight: DIM,
              treadDepth: DIM,
              numRisers: { type: "integer" },
              postSpacing: DIM,
              panelWidth: DIM,
              panelHeight: DIM,
              mullionSize: DIM,
            },
          },
        },
      },
    },
  },
};

export function buildUserText(
  imageCount: number,
  scaleHint: string | undefined,
): string {
  const subject = imageCount > 1 ? "these images" : "this image";
  const multiImageNote =
    imageCount > 1
      ? ` You have been provided ${imageCount} images of the same building from different angles/views. Cross-reference ALL images to get the most accurate and complete building model. Look for details visible in one image but not another (e.g., side windows, rear doors, upper floor layout).`
      : "";
  const scaleNote = scaleHint
    ? ` Scale hint: ${scaleHint}.`
    : " Estimate reasonable dimensions in meters based on typical residential/commercial proportions.";

  return `Analyze ${subject} and generate BIM elements for the COMPLETE building (all floors, roof, stairs, structural elements) as a JSON object with an "elements" array.${multiImageNote}${scaleNote} Use the thinking block for all your reasoning and analysis. Respond with ONLY the JSON object.`;
}
