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
            ],
          },
          name: { type: "string" },
          start: POINT_SCHEMA,
          end: POINT_SCHEMA,
          level: { type: "number" },
          // Null for everything except doors and windows.
          rotation: { type: ["number", "null"] },
          hostWallId: { type: ["string", "null"] },
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
