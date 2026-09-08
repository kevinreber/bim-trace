import {
  AI_MODEL_OPTIONS,
  type AllowedModel,
  DEFAULT_MODEL,
} from "../../server/aiConfig";
import {
  type BimElement,
  type BimElementType,
  type BimMaterialType,
  DEFAULT_PARAMS,
} from "../types";

const SUPPORTED_TYPES: BimElementType[] = [
  "wall",
  "door",
  "window",
  "column",
  "slab",
  "roof",
  "stair",
  "ceiling",
  "beam",
  "railing",
  "curtainWall",
];

const MATERIAL_TYPES: BimMaterialType[] = [
  "concrete",
  "wood",
  "steel",
  "glass",
  "brick",
  "stone",
  "drywall",
  "aluminum",
];

/**
 * Reads the model's material choice, or undefined to fall back to the type
 * default. Anything unrecognised is dropped rather than passed through, since
 * `getMaterialForElement` would otherwise resolve it to the concrete fallback
 * and quietly disguise a bad value as a deliberate one.
 */
function readMaterial(
  item: Record<string, unknown>,
): BimMaterialType | undefined {
  const value = item.material;
  return typeof value === "string" &&
    MATERIAL_TYPES.includes(value as BimMaterialType)
    ? (value as BimMaterialType)
    : undefined;
}

type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

function fileToBase64(
  file: File,
): Promise<{ data: string; mediaType: ImageMediaType }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      const mediaType = (file.type || "image/png") as ImageMediaType;
      resolve({ data: base64, mediaType });
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

/** Wall corners closer than this are treated as the same point. */
const JOIN_TOLERANCE = 0.1;

/**
 * Snaps near-coincident wall endpoints onto a shared point, per level.
 *
 * Models place corners within a few centimetres but almost never emit
 * byte-identical coordinates, which leaves rooms unenclosed and defeats the
 * wall-join and opening logic downstream. Snapping is deterministic and far
 * more reliable than asking the model for exact matching floats — the same
 * reasoning behind deriving door rotation from the host wall rather than
 * trusting the value the model supplied.
 */
export function snapWallEndpoints(walls: BimElement[]): number {
  const ends = walls.flatMap((w) => [
    { point: w.start, level: w.level },
    { point: w.end, level: w.level },
  ]);
  const assigned = new Array<boolean>(ends.length).fill(false);
  let moved = 0;

  for (let i = 0; i < ends.length; i++) {
    if (assigned[i]) continue;
    assigned[i] = true;
    const cluster = [i];

    for (let j = i + 1; j < ends.length; j++) {
      if (assigned[j] || ends[j].level !== ends[i].level) continue;
      const gap = Math.hypot(
        ends[j].point.x - ends[i].point.x,
        ends[j].point.z - ends[i].point.z,
      );
      if (gap <= JOIN_TOLERANCE) {
        assigned[j] = true;
        cluster.push(j);
      }
    }
    if (cluster.length < 2) continue;

    const cx =
      cluster.reduce((t, k) => t + ends[k].point.x, 0) / cluster.length;
    const cz =
      cluster.reduce((t, k) => t + ends[k].point.z, 0) / cluster.length;
    for (const k of cluster) {
      if (ends[k].point.x !== cx || ends[k].point.z !== cz) moved++;
      ends[k].point.x = cx;
      ends[k].point.z = cz;
    }
  }
  return moved;
}

function computeWallAngle(wall: BimElement): number {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  return Math.atan2(dz, dx);
}

export function validateAndFixElements(raw: Record<string, unknown>[]): {
  elements: BimElement[];
  warnings: string[];
} {
  const idMap = new Map<string, string>();
  const elements: BimElement[] = [];
  const orphanedOpenings: string[] = [];
  const unsupportedTypes = new Set<string>();

  // First pass: create walls with fresh UUIDs
  for (const item of raw) {
    const type = item.type as string;
    if (type !== "wall") continue;

    const oldId = item.id as string;
    const newId = crypto.randomUUID();
    idMap.set(oldId, newId);

    const defaultP = DEFAULT_PARAMS.wall;
    const params = item.params as Record<string, unknown> | undefined;

    elements.push({
      id: newId,
      type: "wall",
      name: (item.name as string) || `Wall ${elements.length + 1}`,
      start: validatePoint(item.start),
      end: validatePoint(item.end),
      params: {
        height: asNumber(params?.height, defaultP.height),
        thickness: asNumber(params?.thickness, defaultP.thickness),
      },
      level: asNumber(item.level, 0),
      material: readMaterial(item),
    });
  }

  // Snap before openings are placed: door rotation is derived from the host
  // wall's angle, so the walls must be in final position first.
  const snappedEndpoints = snapWallEndpoints(elements);

  // Second pass: doors and windows with hostWallId remapping
  for (const item of raw) {
    const type = item.type as string;
    if (type !== "door" && type !== "window") continue;

    const newId = crypto.randomUUID();
    const oldHostId = item.hostWallId as string | undefined;
    const hostWallId = oldHostId ? idMap.get(oldHostId) : undefined;

    if (!hostWallId) {
      orphanedOpenings.push(type);
      continue;
    }

    const hostWall = elements.find((el) => el.id === hostWallId);
    const position = validatePoint(item.start);
    const rotation =
      hostWall != null
        ? computeWallAngle(hostWall)
        : asNumber(item.rotation, 0);

    const params = item.params as Record<string, unknown> | undefined;

    if (type === "door") {
      const defaultP = DEFAULT_PARAMS.door;
      elements.push({
        id: newId,
        type: "door",
        name: (item.name as string) || `Door ${elements.length + 1}`,
        start: position,
        end: position,
        params: {
          height: asNumber(params?.height, defaultP.height),
          width: asNumber(params?.width, defaultP.width),
        },
        level: asNumber(item.level, 0),
        material: readMaterial(item),
        rotation,
        hostWallId,
      });
    } else {
      const defaultP = DEFAULT_PARAMS.window;
      elements.push({
        id: newId,
        type: "window",
        name: (item.name as string) || `Window ${elements.length + 1}`,
        start: position,
        end: position,
        params: {
          height: asNumber(params?.height, defaultP.height),
          width: asNumber(params?.width, defaultP.width),
          sillHeight: asNumber(params?.sillHeight, defaultP.sillHeight),
        },
        level: asNumber(item.level, 0),
        material: readMaterial(item),
        rotation,
        hostWallId,
      });
    }
  }

  // Third pass: structural and other elements (column, slab, roof, stair, ceiling, beam)
  for (const item of raw) {
    const type = item.type as string;
    if (!SUPPORTED_TYPES.includes(type as BimElementType)) {
      if (type) unsupportedTypes.add(type);
      continue;
    }
    if (type === "wall" || type === "door" || type === "window") continue;

    const oldId = item.id as string;
    const newId = crypto.randomUUID();
    if (oldId) idMap.set(oldId, newId);

    const params = item.params as Record<string, unknown> | undefined;
    const level = asNumber(item.level, 0);

    switch (type) {
      case "column": {
        const defaultP = DEFAULT_PARAMS.column;
        const position = validatePoint(item.start);
        elements.push({
          id: newId,
          type: "column",
          name: (item.name as string) || `Column ${elements.length + 1}`,
          start: position,
          end: position,
          params: {
            height: asNumber(params?.height, defaultP.height),
            radius: asNumber(params?.radius, defaultP.radius),
          },
          level,
          material: readMaterial(item),
        });
        break;
      }
      case "slab": {
        const defaultP = DEFAULT_PARAMS.slab;
        elements.push({
          id: newId,
          type: "slab",
          name: (item.name as string) || `Slab ${elements.length + 1}`,
          start: validatePoint(item.start),
          end: validatePoint(item.end),
          params: {
            thickness: asNumber(params?.thickness, defaultP.thickness),
          },
          level,
          material: readMaterial(item),
        });
        break;
      }
      case "roof": {
        const defaultP = DEFAULT_PARAMS.roof;
        elements.push({
          id: newId,
          type: "roof",
          name: (item.name as string) || `Roof ${elements.length + 1}`,
          start: validatePoint(item.start),
          end: validatePoint(item.end),
          params: {
            height: asNumber(params?.height, defaultP.height),
            thickness: asNumber(params?.thickness, defaultP.thickness),
            overhang: asNumber(params?.overhang, defaultP.overhang),
          },
          level,
          material: readMaterial(item),
          // The only element outside the door/window pass that uses rotation:
          // it sets which axis the ridge runs along. Dropping it here silently
          // undid the whole ridge-direction feature.
          rotation: asNumber(item.rotation, 0),
        });
        break;
      }
      case "stair": {
        const defaultP = DEFAULT_PARAMS.stair;
        elements.push({
          id: newId,
          type: "stair",
          name: (item.name as string) || `Stair ${elements.length + 1}`,
          start: validatePoint(item.start),
          end: validatePoint(item.end),
          params: {
            riserHeight: asNumber(params?.riserHeight, defaultP.riserHeight),
            treadDepth: asNumber(params?.treadDepth, defaultP.treadDepth),
            width: asNumber(params?.width, defaultP.width),
            numRisers: asNumber(params?.numRisers, defaultP.numRisers),
          },
          level,
          material: readMaterial(item),
        });
        break;
      }
      case "ceiling": {
        const defaultP = DEFAULT_PARAMS.ceiling;
        elements.push({
          id: newId,
          type: "ceiling",
          name: (item.name as string) || `Ceiling ${elements.length + 1}`,
          start: validatePoint(item.start),
          end: validatePoint(item.end),
          params: {
            thickness: asNumber(params?.thickness, defaultP.thickness),
          },
          level,
          material: readMaterial(item),
        });
        break;
      }
      case "beam": {
        const defaultP = DEFAULT_PARAMS.beam;
        elements.push({
          id: newId,
          type: "beam",
          name: (item.name as string) || `Beam ${elements.length + 1}`,
          start: validatePoint(item.start),
          end: validatePoint(item.end),
          params: {
            height: asNumber(params?.height, defaultP.height),
            width: asNumber(params?.width, defaultP.width),
          },
          level,
          material: readMaterial(item),
        });
        break;
      }
      case "railing": {
        const defaultP = DEFAULT_PARAMS.railing;
        elements.push({
          id: newId,
          type: "railing",
          name: (item.name as string) || `Railing ${elements.length + 1}`,
          start: validatePoint(item.start),
          end: validatePoint(item.end),
          params: {
            height: asNumber(params?.height, defaultP.height),
            postSpacing: asNumber(params?.postSpacing, defaultP.postSpacing),
          },
          level,
          material: readMaterial(item),
        });
        break;
      }
      case "curtainWall": {
        const defaultP = DEFAULT_PARAMS.curtainWall;
        elements.push({
          id: newId,
          type: "curtainWall",
          name: (item.name as string) || `Curtain Wall ${elements.length + 1}`,
          start: validatePoint(item.start),
          end: validatePoint(item.end),
          params: {
            height: asNumber(params?.height, defaultP.height),
            panelWidth: asNumber(params?.panelWidth, defaultP.panelWidth),
            panelHeight: asNumber(params?.panelHeight, defaultP.panelHeight),
            mullionSize: asNumber(params?.mullionSize, defaultP.mullionSize),
          },
          level,
          material: readMaterial(item),
        });
        break;
      }
    }
  }

  const warnings: string[] = [];
  if (snappedEndpoints > 0) {
    warnings.push(
      `Closed ${snappedEndpoints} wall corner${snappedEndpoints !== 1 ? "s" : ""} that the model left with a small gap.`,
    );
  }
  if (orphanedOpenings.length > 0) {
    const doors = orphanedOpenings.filter((t) => t === "door").length;
    const windows = orphanedOpenings.length - doors;
    const parts: string[] = [];
    if (doors > 0) parts.push(`${doors} door${doors !== 1 ? "s" : ""}`);
    if (windows > 0) parts.push(`${windows} window${windows !== 1 ? "s" : ""}`);
    warnings.push(
      `Discarded ${parts.join(" and ")} that referenced a wall the model never generated.`,
    );
  }
  if (unsupportedTypes.size > 0) {
    warnings.push(
      `Ignored unsupported element type${unsupportedTypes.size !== 1 ? "s" : ""}: ${Array.from(unsupportedTypes).join(", ")}.`,
    );
  }

  return { elements, warnings };
}

/**
 * Recovers the complete leading elements from a response cut off mid-array.
 *
 * A single runaway number is enough to truncate an otherwise good building, and
 * without this the whole response is discarded — the user sees "AI did not
 * return valid JSON" and loses dozens of perfectly good elements.
 */
export function salvageTruncatedElements(text: string): unknown[] | null {
  const arrayStart = text.indexOf("[");
  if (arrayStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastComplete = -1;

  for (let i = arrayStart + 1; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString) {
      if (ch === "{" || ch === "[") {
        depth++;
      } else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) lastComplete = i;
        if (depth < 0) break;
      }
    }
  }

  if (lastComplete === -1) return null;
  try {
    const recovered: unknown = JSON.parse(
      `${text.slice(arrayStart, lastComplete + 1)}]`,
    );
    return Array.isArray(recovered) ? recovered : null;
  } catch {
    return null;
  }
}

function validatePoint(point: unknown): { x: number; z: number } {
  if (point != null && typeof point === "object") {
    const p = point as Record<string, unknown>;
    return {
      x: asNumber(p.x, 0),
      z: asNumber(p.z, 0),
    };
  }
  return { x: 0, z: 0 };
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

export interface AiGenerateResult {
  elements: BimElement[];
  warnings: string[];
  wallCount: number;
  doorCount: number;
  windowCount: number;
  columnCount: number;
  slabCount: number;
  roofCount: number;
  stairCount: number;
  ceilingCount: number;
  beamCount: number;
  levelCount: number;
}

export type AiModelId = AllowedModel;

export const AI_MODELS: { id: AiModelId; label: string }[] = AI_MODEL_OPTIONS;

export interface ServerPayload {
  text?: string;
  stopReason?: string;
  usage?: unknown;
  error?: string;
}

/**
 * Reads the endpoint's response body.
 *
 * Two things this has to survive. The body may open with whitespace — the
 * proxies send a keep-alive byte while the model works, because a platform that
 * kills a silent function would otherwise replace the whole response. And the
 * body may report a failure under a 200, since the status is committed before
 * the outcome is known, so `error` is checked regardless of status.
 *
 * A body that is not JSON at all means something upstream answered instead of
 * the endpoint — a gateway timeout page, typically. Reporting that as a JSON
 * syntax error tells the user nothing, so it is surfaced as what it is.
 */
export function readServerPayload(
  raw: string,
  status: number,
): ServerPayload & { text: string } {
  let parsed: ServerPayload;
  try {
    parsed = JSON.parse(raw) as ServerPayload;
  } catch {
    const preview = raw.trim().slice(0, 200) || "(empty response)";
    throw new Error(
      `The server did not return a valid response (HTTP ${status}). This usually means the request timed out before the model finished. Response began: "${preview}"`,
    );
  }
  if (parsed?.error) throw new Error(parsed.error);
  if (status < 200 || status >= 300) {
    throw new Error(`Server error (HTTP ${status}).`);
  }
  if (typeof parsed?.text !== "string") {
    throw new Error("The server response contained no generated text.");
  }
  return parsed as ServerPayload & { text: string };
}

export async function generateFloorPlan(
  apiKey: string,
  imageFiles: File[],
  scaleHint?: string,
  model?: AiModelId,
  signal?: AbortSignal,
): Promise<AiGenerateResult> {
  const images = await Promise.all(imageFiles.map(fileToBase64));

  const response = await fetch("/api/generate-floor-plan", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      images: images.map(({ data, mediaType }) => ({
        imageBase64: data,
        mediaType,
      })),
      scaleHint: scaleHint || undefined,
      model: model || DEFAULT_MODEL,
    }),
  });

  const json = readServerPayload(await response.text(), response.status);

  let jsonText = json.text.trim();

  // Strip markdown code fences if present
  if (jsonText.startsWith("```")) {
    jsonText = jsonText
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

  const responseWarnings: string[] = [];
  const stopReason = json.stopReason;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Try to extract a JSON array from the response text (model may have added text around it)
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        parsed = JSON.parse(arrayMatch[0]);
      } catch {
        // Still not valid JSON
      }
    }

    if (parsed === undefined) {
      const recovered = salvageTruncatedElements(jsonText);
      if (recovered && recovered.length > 0) {
        parsed = recovered;
        responseWarnings.push(
          `The response was cut off before it finished${
            stopReason === "max_tokens" ? " (hit the output limit)" : ""
          }. Recovered ${recovered.length} complete elements — the building is probably incomplete.`,
        );
      }
    }

    if (parsed === undefined) {
      const preview =
        jsonText.length > 200 ? `${jsonText.slice(0, 200)}…` : jsonText;
      throw new Error(`AI did not return valid JSON. Response: "${preview}"`);
    }
  }

  if (stopReason === "max_tokens" && responseWarnings.length === 0) {
    responseWarnings.push(
      "The response hit the output limit. Some of the building may be missing.",
    );
  }

  if (!Array.isArray(parsed)) {
    if (
      parsed &&
      typeof parsed === "object" &&
      "elements" in (parsed as Record<string, unknown>)
    ) {
      const inner = (parsed as Record<string, unknown>).elements;
      if (Array.isArray(inner)) {
        parsed = inner;
      } else {
        throw new Error("AI response is not an array of elements");
      }
    } else {
      throw new Error("AI response is not an array of elements");
    }
  }

  const parsedArray = parsed as unknown[];
  if (parsedArray.length === 0) {
    throw new Error(
      "AI returned an empty layout. Try uploading a floor plan image with visible walls, doors, and windows.",
    );
  }

  const { elements, warnings } = validateAndFixElements(
    parsedArray as Record<string, unknown>[],
  );

  if (elements.length === 0) {
    throw new Error(
      "No valid elements could be extracted. Try a clearer floor plan image.",
    );
  }

  const levels = new Set(elements.map((e) => e.level));

  return {
    elements,
    warnings: [...responseWarnings, ...warnings],
    wallCount: elements.filter((e) => e.type === "wall").length,
    doorCount: elements.filter((e) => e.type === "door").length,
    windowCount: elements.filter((e) => e.type === "window").length,
    columnCount: elements.filter((e) => e.type === "column").length,
    slabCount: elements.filter((e) => e.type === "slab").length,
    roofCount: elements.filter((e) => e.type === "roof").length,
    stairCount: elements.filter((e) => e.type === "stair").length,
    ceilingCount: elements.filter((e) => e.type === "ceiling").length,
    beamCount: elements.filter((e) => e.type === "beam").length,
    levelCount: levels.size,
  };
}
