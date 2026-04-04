import Anthropic from "@anthropic-ai/sdk";
import { type BimElement, type BimElementType, DEFAULT_PARAMS } from "../types";

const SUPPORTED_TYPES: BimElementType[] = ["wall", "door", "window"];

const SYSTEM_PROMPT = `You are a BIM (Building Information Modeling) assistant that analyzes images and generates structured building element data.

CRITICAL RULES:
1. You MUST respond with ONLY a raw JSON array — no markdown, no code fences, no explanation, no commentary.
2. NEVER refuse to generate elements. Even if the image is not a perfect floor plan (e.g. an exterior photo, a sketch, a 3D render), do your best to infer a plausible floor layout and generate walls, doors, and windows.
3. If you truly cannot infer any layout, return an empty array: []
4. Your response must ALWAYS be valid JSON. No text before or after the JSON array.

## BimElement Schema

Each element has this shape:
{
  "id": string,        // unique identifier (use "wall-1", "wall-2", "door-1", etc.)
  "type": "wall" | "door" | "window",
  "name": string,      // descriptive name like "Exterior Wall North"
  "start": { "x": number, "z": number },  // start point in meters on ground plane
  "end": { "x": number, "z": number },    // end point (same as start for doors/windows)
  "params": object,    // type-specific parameters (see below)
  "level": 0,          // always 0 for ground floor
  "rotation": number | undefined,   // Y-axis rotation in radians (doors/windows only)
  "hostWallId": string | undefined  // ID of the wall this door/window is on
}

## Type-Specific Params

- wall:   { "height": 3, "thickness": 0.2 }
- door:   { "height": 2.1, "width": 0.9 }
- window: { "height": 1.2, "width": 1.0, "sillHeight": 0.9 }

Use these default dimensions unless the image clearly shows different proportions.

## Coordinate System

- X axis = left-right (positive = right)
- Z axis = up-down on the floor plan (positive = toward viewer / "south")
- Y axis = vertical height (not used in coordinates, only in params)
- Center the layout around origin (0, 0)
- All measurements in meters

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

## Example Output

[
  { "id": "wall-1", "type": "wall", "name": "North Wall", "start": { "x": -5, "z": -3 }, "end": { "x": 5, "z": -3 }, "params": { "height": 3, "thickness": 0.2 }, "level": 0 },
  { "id": "wall-2", "type": "wall", "name": "East Wall", "start": { "x": 5, "z": -3 }, "end": { "x": 5, "z": 3 }, "params": { "height": 3, "thickness": 0.2 }, "level": 0 },
  { "id": "door-1", "type": "door", "name": "Entry Door", "start": { "x": 0, "z": -3 }, "end": { "x": 0, "z": -3 }, "params": { "height": 2.1, "width": 0.9 }, "level": 0, "rotation": 0, "hostWallId": "wall-1" }
]

Analyze the image carefully. Identify all walls, doors, and windows. Generate accurate coordinates that reflect the layout's proportions and connectivity.
If the image is an exterior photo or 3D rendering, infer the floor plan layout from visible features (facade width, visible doors/windows, typical room arrangements).
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
      level: 0,
    });
  }

  // Second pass: doors and windows with hostWallId remapping
  for (const item of raw) {
    const type = item.type as string;
    if (type !== "door" && type !== "window") continue;
    if (!SUPPORTED_TYPES.includes(type as BimElementType)) continue;

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
        level: 0,
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
        level: 0,
        rotation,
        hostWallId,
      });
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
}

export async function generateFloorPlan(
  apiKey: string,
  imageFile: File,
  scaleHint?: string,
): Promise<AiGenerateResult> {
  const { data, mediaType } = await fileToBase64(imageFile);

  const userText = scaleHint
    ? `Analyze this image and generate BIM elements as a JSON array. Scale hint: ${scaleHint}. Respond with ONLY the JSON array.`
    : "Analyze this image and generate BIM elements as a JSON array. Estimate reasonable dimensions in meters based on typical residential/commercial proportions. Respond with ONLY the JSON array.";

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data },
          },
          { type: "text", text: userText },
        ],
      },
    ],
  });

  // Extract text from response
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

  return {
    elements,
    wallCount: elements.filter((e) => e.type === "wall").length,
    doorCount: elements.filter((e) => e.type === "door").length,
    windowCount: elements.filter((e) => e.type === "window").length,
  };
}
