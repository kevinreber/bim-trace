import { type BimElement, type BimElementType, DEFAULT_PARAMS } from "../types";

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
];

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

function computeWallAngle(wall: BimElement): number {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  return Math.atan2(dz, dx);
}

function validateAndFixElements(raw: Record<string, unknown>[]): BimElement[] {
  const idMap = new Map<string, string>();
  const elements: BimElement[] = [];

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
    });
  }

  // Second pass: doors and windows with hostWallId remapping
  for (const item of raw) {
    const type = item.type as string;
    if (type !== "door" && type !== "window") continue;

    const newId = crypto.randomUUID();
    const oldHostId = item.hostWallId as string | undefined;
    const hostWallId = oldHostId ? idMap.get(oldHostId) : undefined;

    if (!hostWallId) continue;

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
        rotation,
        hostWallId,
      });
    }
  }

  // Third pass: structural and other elements (column, slab, roof, stair, ceiling, beam)
  for (const item of raw) {
    const type = item.type as string;
    if (!SUPPORTED_TYPES.includes(type as BimElementType)) continue;
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
        });
        break;
      }
    }
  }

  return elements;
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

export type AiModelId = "claude-opus-4-20250514" | "claude-sonnet-4-20250514";

export const AI_MODELS: { id: AiModelId; label: string }[] = [
  { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
];

export async function generateFloorPlan(
  apiKey: string,
  imageFiles: File[],
  scaleHint?: string,
  model?: AiModelId,
): Promise<AiGenerateResult> {
  const images = await Promise.all(imageFiles.map(fileToBase64));

  const response = await fetch("/api/generate-floor-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      images: images.map(({ data, mediaType }) => ({
        imageBase64: data,
        mediaType,
      })),
      scaleHint: scaleHint || undefined,
      model: model || "claude-opus-4-20250514",
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || "Server error");
  }

  let jsonText = (json.text as string).trim();

  // Strip markdown code fences if present
  if (jsonText.startsWith("```")) {
    jsonText = jsonText
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

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
      const preview =
        jsonText.length > 200 ? `${jsonText.slice(0, 200)}…` : jsonText;
      throw new Error(`AI did not return valid JSON. Response: "${preview}"`);
    }
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

  const elements = validateAndFixElements(
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
