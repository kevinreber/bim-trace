import Anthropic from "@anthropic-ai/sdk";
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

const SYSTEM_PROMPT = `You are a BIM (Building Information Modeling) assistant that analyzes images and generates structured building element data for COMPLETE multi-story buildings.

CRITICAL RULES:
1. You MUST respond with ONLY a raw JSON array — no markdown, no code fences, no explanation, no commentary.
2. NEVER refuse to generate elements. Even if the image is not a perfect floor plan (e.g. an exterior photo, a sketch, a 3D render), do your best to infer a plausible COMPLETE building and generate ALL floors, roof, stairs, and structural elements.
3. If you truly cannot infer any layout, return an empty array: []
4. Your response must ALWAYS be valid JSON. No text before or after the JSON array.
5. Generate the ENTIRE building — all visible floors, not just the ground floor.

## BimElement Schema

Each element has this shape:
{
  "id": string,        // unique identifier (use "wall-1", "wall-2", "door-1", "roof-1", "slab-1", etc.)
  "type": "wall" | "door" | "window" | "column" | "slab" | "roof" | "stair" | "ceiling" | "beam",
  "name": string,      // descriptive name like "Exterior Wall North - Level 1"
  "start": { "x": number, "z": number },  // start point in meters on ground plane
  "end": { "x": number, "z": number },    // end point (same as start for point elements)
  "params": object,    // type-specific parameters (see below)
  "level": number,     // floor level height in meters (0 = ground, 3 = level 1, 6 = level 2, etc.)
  "rotation": number | undefined,   // Y-axis rotation in radians (doors/windows only)
  "hostWallId": string | undefined  // ID of the wall this door/window is on
}

## Type-Specific Params

- wall:    { "height": 3, "thickness": 0.2 }
- door:    { "height": 2.1, "width": 0.9 }
- window:  { "height": 1.2, "width": 1.0, "sillHeight": 0.9 }
- column:  { "height": 3, "radius": 0.15 }
- slab:    { "thickness": 0.25 }
- roof:    { "height": 2.5, "thickness": 0.2, "overhang": 0.3 }
- stair:   { "riserHeight": 0.18, "treadDepth": 0.28, "width": 1.0, "numRisers": 14 }
- ceiling: { "thickness": 0.15 }
- beam:    { "height": 0.4, "width": 0.3 }

Use these default dimensions unless the image clearly shows different proportions.

## Coordinate System

- X axis = left-right (positive = right)
- Z axis = up-down on the floor plan (positive = toward viewer / "south")
- Y axis = vertical height (not used in coordinates, only in params — level handles vertical placement)
- Center the layout around origin (0, 0)
- All measurements in meters

## Multi-Story Rules

- Each floor's elements use a different "level" value (0 for ground, 3 for 1st floor, 6 for 2nd floor, etc.)
- Duplicate the wall layout for each visible floor (upper floors may have a smaller footprint)
- Walls on upper floors should have IDs like "wall-L1-1", "wall-L2-1" to distinguish from ground floor
- Doors and windows on upper floors must reference walls on the SAME level
- Add a slab between each floor (the slab sits at the level height)
- Add stairs to connect floors

## Wall Rules

- Walls are defined by start and end points (two endpoints of the wall centerline)
- Walls should form connected loops for rooms (endpoints should meet at corners)
- Use consistent thickness (0.2m default, 0.3m for exterior walls)

## Door & Window Rules

- Doors and windows MUST reference a hostWallId (the ID of the wall they're on)
- Their start and end should be the same point — the center position on the wall
- The position must lie between the wall's start and end points (on the wall centerline)
- rotation must match the wall's angle: atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x)
- Standard door width: 0.9m, window width: 1.0m
- Place doors at logical entry points and windows on exterior walls

## Slab Rules

- Slabs are defined by start and end points forming a rectangular footprint (opposite corners)
- Ground floor slab at level 0, upper floor slabs at level 3, 6, etc.
- Thickness is typically 0.25m

## Roof Rules

- Roof is defined by start and end points forming the rectangular base (opposite corners)
- Place roof at the top level (e.g. level 6 for a 2-story building, level 3 for single-story)
- The "height" param controls the roof peak height above the base

## Stair Rules

- Stairs are defined by start and end points (bottom to top of staircase)
- Place stairs at the level they start from (level 0 stairs connect ground to level 1)
- numRisers controls how many steps (typically 14-17 for a full floor height of ~3m)

## Column Rules

- Columns use start and end as the same point (center position)
- Commonly placed at porch areas, structural supports, or decorative elements

## Example Multi-Story Output

[
  { "id": "slab-g", "type": "slab", "name": "Ground Floor Slab", "start": { "x": -6, "z": -4 }, "end": { "x": 6, "z": 4 }, "params": { "thickness": 0.25 }, "level": 0 },
  { "id": "wall-1", "type": "wall", "name": "North Wall - Ground", "start": { "x": -6, "z": -4 }, "end": { "x": 6, "z": -4 }, "params": { "height": 3, "thickness": 0.3 }, "level": 0 },
  { "id": "wall-2", "type": "wall", "name": "East Wall - Ground", "start": { "x": 6, "z": -4 }, "end": { "x": 6, "z": 4 }, "params": { "height": 3, "thickness": 0.3 }, "level": 0 },
  { "id": "door-1", "type": "door", "name": "Entry Door", "start": { "x": 0, "z": -4 }, "end": { "x": 0, "z": -4 }, "params": { "height": 2.1, "width": 0.9 }, "level": 0, "rotation": 0, "hostWallId": "wall-1" },
  { "id": "window-1", "type": "window", "name": "Front Window", "start": { "x": -3, "z": -4 }, "end": { "x": -3, "z": -4 }, "params": { "height": 1.2, "width": 1.0, "sillHeight": 0.9 }, "level": 0, "rotation": 0, "hostWallId": "wall-1" },
  { "id": "slab-1", "type": "slab", "name": "Level 1 Floor Slab", "start": { "x": -6, "z": -4 }, "end": { "x": 6, "z": 4 }, "params": { "thickness": 0.25 }, "level": 3 },
  { "id": "wall-L1-1", "type": "wall", "name": "North Wall - Level 1", "start": { "x": -6, "z": -4 }, "end": { "x": 6, "z": -4 }, "params": { "height": 3, "thickness": 0.3 }, "level": 3 },
  { "id": "window-L1-1", "type": "window", "name": "Upper Window", "start": { "x": 0, "z": -4 }, "end": { "x": 0, "z": -4 }, "params": { "height": 1.2, "width": 1.0, "sillHeight": 0.9 }, "level": 3, "rotation": 0, "hostWallId": "wall-L1-1" },
  { "id": "stair-1", "type": "stair", "name": "Main Staircase", "start": { "x": 2, "z": 0 }, "end": { "x": 2, "z": 3 }, "params": { "riserHeight": 0.18, "treadDepth": 0.28, "width": 1.0, "numRisers": 17 }, "level": 0 },
  { "id": "roof-1", "type": "roof", "name": "Main Roof", "start": { "x": -6.3, "z": -4.3 }, "end": { "x": 6.3, "z": 4.3 }, "params": { "height": 2.5, "thickness": 0.2, "overhang": 0.3 }, "level": 6 }
]

## Analysis Strategy — THINK STEP BY STEP

Before generating JSON, reason carefully about the building:

1. **Count floors**: Look for horizontal bands of windows, floor lines, roof eaves, and visible floor separations. A two-story house has TWO rows of windows stacked vertically. A dormer or attic with windows counts as an additional level.
2. **Identify the footprint**: Estimate width and depth. Note any L-shapes, extensions, garages, or wings.
3. **Map each floor**: For EACH floor level, identify exterior walls, interior walls (if visible), doors, and windows. Upper floors may have a different or smaller footprint.
4. **Structural elements**: Look for columns (porch posts, structural supports), beams, and any visible framing.
5. **Roof shape**: Note the roof type (gable, hip, flat, shed, dormer). Place the roof at the correct top level.
6. **Stairs**: If the building has multiple floors, there MUST be stairs connecting them.

CRITICAL: If you see two rows of windows vertically, that is a TWO-STORY building. Generate walls, slabs, doors, and windows for BOTH levels. Do NOT collapse everything to level 0.

When multiple images are provided, cross-reference them:
- Front photo shows window count and door placement
- Side photos reveal building depth and side windows
- Rear photos show back doors, windows, and any extensions

Analyze the image(s) carefully. Generate the COMPLETE building with ALL floors visible.
If the image is an exterior photo, count visible floor levels and infer the full layout.
Remember: respond with ONLY the JSON array, nothing else.`;

type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

function fileToBase64(
  file: File,
): Promise<{ data: string; mediaType: ImageMediaType }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/...;base64, prefix
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

    // Skip doors/windows without a valid host wall
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

export async function generateFloorPlan(
  apiKey: string,
  imageFiles: File[],
  scaleHint?: string,
): Promise<AiGenerateResult> {
  const images = await Promise.all(imageFiles.map(fileToBase64));

  const imageCount = images.length;
  const multiImageNote =
    imageCount > 1
      ? ` You have been provided ${imageCount} images of the same building from different angles/views. Cross-reference ALL images to get the most accurate and complete building model. Look for details visible in one image but not another (e.g., side windows, rear doors, upper floor layout).`
      : "";

  const userText = scaleHint
    ? `Analyze ${imageCount > 1 ? "these images" : "this image"} and generate BIM elements for the COMPLETE building (all floors, roof, stairs, structural elements) as a JSON array.${multiImageNote} Scale hint: ${scaleHint}. First reason step-by-step about the building structure, then output ONLY the JSON array.`
    : `Analyze ${imageCount > 1 ? "these images" : "this image"} and generate BIM elements for the COMPLETE building (all floors, roof, stairs, structural elements) as a JSON array.${multiImageNote} Estimate reasonable dimensions in meters based on typical residential/commercial proportions. First reason step-by-step about the building structure, then output ONLY the JSON array.`;

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  // Build content array with all images
  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];
  for (const { data, mediaType } of images) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data },
    });
  }
  content.push({ type: "text", text: userText });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    thinking: {
      type: "enabled",
      budget_tokens: 8000,
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  // Extract text from response (skip thinking blocks)
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response received from AI");
  }

  let jsonText = textBlock.text.trim();

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
    // The AI returned non-JSON text — extract a useful message for the user
    const preview =
      jsonText.length > 200 ? `${jsonText.slice(0, 200)}…` : jsonText;
    throw new Error(`AI did not return valid JSON. Response: "${preview}"`);
  }

  if (!Array.isArray(parsed)) {
    // Might be a wrapper object with an array inside
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
