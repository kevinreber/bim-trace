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
2. Do ALL your reasoning in the thinking block. The text response must contain ONLY the JSON array.
3. NEVER refuse to generate elements. Even if the image is not a perfect floor plan (e.g. an exterior photo, a sketch, a 3D render), do your best to infer a plausible COMPLETE building and generate ALL floors, roof, stairs, and structural elements.
4. If you truly cannot infer any layout, return an empty array: []
5. Your response must ALWAYS be valid JSON. No text before or after the JSON array.
6. Generate the ENTIRE building — all visible floors, not just the ground floor.

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

## Example: Complex Residential Home with L-Shaped Footprint

This example shows a home with a main body + left porch wing, steep gable roof, porch columns, and varied window sizes:

[
  { "id": "slab-g", "type": "slab", "name": "Ground Floor Slab", "start": { "x": -7, "z": -5 }, "end": { "x": 6, "z": 5 }, "params": { "thickness": 0.25 }, "level": 0 },
  { "id": "wall-1", "type": "wall", "name": "Front Wall - Main Body", "start": { "x": -3, "z": -5 }, "end": { "x": 6, "z": -5 }, "params": { "height": 3, "thickness": 0.3 }, "level": 0 },
  { "id": "wall-2", "type": "wall", "name": "East Wall", "start": { "x": 6, "z": -5 }, "end": { "x": 6, "z": 5 }, "params": { "height": 3, "thickness": 0.3 }, "level": 0 },
  { "id": "wall-3", "type": "wall", "name": "Rear Wall", "start": { "x": 6, "z": 5 }, "end": { "x": -7, "z": 5 }, "params": { "height": 3, "thickness": 0.3 }, "level": 0 },
  { "id": "wall-4", "type": "wall", "name": "West Wall - Main Body", "start": { "x": -3, "z": 5 }, "end": { "x": -3, "z": 2 }, "params": { "height": 3, "thickness": 0.3 }, "level": 0 },
  { "id": "wall-5", "type": "wall", "name": "Porch North Wall", "start": { "x": -3, "z": 2 }, "end": { "x": -7, "z": 2 }, "params": { "height": 3, "thickness": 0.3 }, "level": 0 },
  { "id": "wall-6", "type": "wall", "name": "Porch West Wall", "start": { "x": -7, "z": 2 }, "end": { "x": -7, "z": 5 }, "params": { "height": 3, "thickness": 0.3 }, "level": 0 },
  { "id": "door-1", "type": "door", "name": "Main Entry Door", "start": { "x": 1, "z": -5 }, "end": { "x": 1, "z": -5 }, "params": { "height": 2.4, "width": 1.5 }, "level": 0, "rotation": 0, "hostWallId": "wall-1" },
  { "id": "window-1", "type": "window", "name": "Large Picture Window Right", "start": { "x": 4, "z": -5 }, "end": { "x": 4, "z": -5 }, "params": { "height": 2.0, "width": 2.4, "sillHeight": 0.5 }, "level": 0, "rotation": 0, "hostWallId": "wall-1" },
  { "id": "window-2", "type": "window", "name": "Small Window Left", "start": { "x": -1.5, "z": -5 }, "end": { "x": -1.5, "z": -5 }, "params": { "height": 1.2, "width": 0.8, "sillHeight": 0.9 }, "level": 0, "rotation": 0, "hostWallId": "wall-1" },
  { "id": "col-1", "type": "column", "name": "Porch Column Left", "start": { "x": -7, "z": 2 }, "end": { "x": -7, "z": 2 }, "params": { "height": 3, "radius": 0.15 }, "level": 0 },
  { "id": "col-2", "type": "column", "name": "Porch Column Right", "start": { "x": -3, "z": 2 }, "end": { "x": -3, "z": 2 }, "params": { "height": 3, "radius": 0.15 }, "level": 0 },
  { "id": "slab-1", "type": "slab", "name": "Upper Floor Slab", "start": { "x": -3, "z": -5 }, "end": { "x": 6, "z": 5 }, "params": { "thickness": 0.25 }, "level": 3 },
  { "id": "wall-L1-1", "type": "wall", "name": "Front Wall - Upper", "start": { "x": -1, "z": -5 }, "end": { "x": 4, "z": -5 }, "params": { "height": 3, "thickness": 0.3 }, "level": 3 },
  { "id": "window-L1-1", "type": "window", "name": "Upper Dormer Window", "start": { "x": 1.5, "z": -5 }, "end": { "x": 1.5, "z": -5 }, "params": { "height": 1.0, "width": 0.8, "sillHeight": 0.9 }, "level": 3, "rotation": 0, "hostWallId": "wall-L1-1" },
  { "id": "stair-1", "type": "stair", "name": "Main Staircase", "start": { "x": 3, "z": 2 }, "end": { "x": 3, "z": 5 }, "params": { "riserHeight": 0.18, "treadDepth": 0.28, "width": 1.0, "numRisers": 17 }, "level": 0 },
  { "id": "roof-1", "type": "roof", "name": "Main Gable Roof", "start": { "x": -3.3, "z": -5.3 }, "end": { "x": 6.3, "z": 5.3 }, "params": { "height": 4.0, "thickness": 0.2, "overhang": 0.5 }, "level": 3 },
  { "id": "roof-2", "type": "roof", "name": "Porch Roof", "start": { "x": -7.3, "z": 1.7 }, "end": { "x": -2.7, "z": 5.3 }, "params": { "height": 1.5, "thickness": 0.2, "overhang": 0.3 }, "level": 3 }
]

Key patterns in this example:
- The L-shape is formed by separate wall segments with shared corners, NOT a single rectangle
- Windows have VARIED sizes (large picture window 2.4m wide vs small window 0.8m wide)
- The front door is wider than standard (double door = 1.5m)
- Porch columns mark covered outdoor areas
- Multiple roof elements cover different sections with different heights
- Upper floor has a SMALLER footprint than ground floor (common in Cape Cod / dormer styles)
- Roof height is steep (4.0m) for a gable style

## Depth & 3D Inference from 2D Photos

When analyzing exterior photos (not floor plans), use these techniques to infer the full 3D building:

### Estimating Building Depth (the Z axis — front to back)
- **Roof ridge lines**: A visible ridge line indicates depth. A gable roof's ridge runs along the depth axis. The roof slope angle suggests the depth-to-height ratio.
- **Perspective convergence**: Walls receding into the distance reveal depth. If a side wall is partially visible, estimate its length from the visible angle.
- **Typical proportions**: Residential buildings are typically 8-12m deep. A building that appears roughly square from the front is likely 0.8-1.2x as deep as it is wide.
- **Visible side walls**: If any side wall is visible, estimate its length. Count windows on the side to gauge depth (windows are typically spaced 2-3m apart).
- **Chimneys and extensions**: A chimney near the back suggests the depth extends at least that far. Visible extensions (bump-outs, additions) add depth.
- **Garage/wing setbacks**: Wings or garages that are set back reveal depth relationships.

### Estimating Dimensions from Scale Cues
- **Doors**: Standard entry door is ~0.9m wide × 2.1m tall — use as a scale reference.
- **Windows**: Typical window ~1.0m wide × 1.2m tall. Window spacing on a facade helps estimate total wall length.
- **Floor-to-floor height**: Typically 3m. Count floor levels by window rows.
- **Brick/siding courses**: Standard brick is ~65mm high + 10mm mortar = 75mm per course.
- **Human figures/cars**: If visible, use as scale references (car ~4.5m long, person ~1.7m tall).

### Building Non-Rectangular Footprints
- MOST residential buildings are NOT simple rectangles. Look for L-shapes, T-shapes, or wings.
- Porches (covered outdoor areas with columns/posts) need their own wall segments and column elements.
- Bay windows that project outward should be represented as angled wall segments.
- If a building has clearly different roof sections (different heights, ridge directions), each section covers a different wing.
- When the front facade has sections at different depths (one part closer to the street, another set back), model each section with its own wall segments.

### Window Variety
- Pay close attention to window SIZES. Buildings often have multiple window types:
  - Large picture/display windows: 2.0-3.0m wide × 1.8-2.4m tall, sillHeight 0.3-0.5m
  - Standard double-hung windows: 0.8-1.0m wide × 1.2-1.5m tall, sillHeight 0.9m
  - Tall narrow windows: 0.5-0.7m wide × 1.5-2.0m tall
  - Dormer windows: typically smaller, 0.6-0.8m wide
  - Multi-pane grid windows (visible grilles/mullions) are still single window elements — just note the larger overall size
- Count EVERY visible window and match its approximate size and position on the wall.
- French doors or glass doors with sidelights should be modeled as a wider door (1.5-1.8m).

### Porch & Entry Features
- Covered porches have columns/posts — add column elements at each post location.
- Arched openings indicate a porch with an open front — place columns at the arch spring points.
- Front entry steps/stoops are not modeled but the door and any flanking sidelights/windows should be.
- A recessed entry (set back from the main facade) means the entry wall is on a different Z-plane than the main front wall.

## Analysis Strategy — THINK STEP BY STEP (in the thinking block)

Use the thinking block to reason carefully — the text response must be ONLY JSON.

1. **Scale reference**: Find a door or window to establish scale. A front door is ~0.9m wide, 2.1m tall. Use this to estimate all other dimensions.
2. **Count floors**: Look for horizontal bands of windows, floor lines, roof eaves. Two rows of windows = TWO stories. Dormers with windows = additional level.
3. **Trace the footprint shape**: Do NOT default to a rectangle. Walk along the front facade left to right — does the wall step forward or back? Are there wings, porches, or bump-outs? Sketch the full perimeter as wall segments. For buildings seen at an angle, trace the side wall too.
4. **Estimate depth**: Use the roof slope, visible side walls, and typical proportions (depth ≈ 0.7-1.2× facade width for residential). A steep gable roof implies significant depth.
5. **Map each floor**: For EACH floor, trace exterior walls (with different wall segments for different footprint sections). Upper floors often have a SMALLER footprint.
6. **Count and size ALL windows**: Go left to right across the facade. Note each window's approximate size category (small/standard/large/picture). Large multi-pane windows may be 2-3× wider than standard ones. Don't miss any.
7. **Doors**: Front entry, side doors, French doors. Double doors or doors with sidelights = wider width (1.2-1.8m).
8. **Columns/posts**: Every porch post, every decorative column. Place them at the correct positions.
9. **Multiple roofs**: Complex homes have 2-4 roof elements — main ridge, cross gable, porch roof, dormer roofs. Each has different height and coverage.
10. **Stairs**: Multi-story buildings MUST have interior stairs connecting levels.

### Common Mistakes to Avoid
- DO NOT make a simple rectangle when the building clearly has wings, porches, or extensions
- DO NOT make all windows the same size — buildings have varied window types
- DO NOT forget porch columns/posts visible in the image
- DO NOT use a low roof height for steep gable roofs (use 3.0-5.0m for steep residential gables)
- DO NOT make the building too shallow (typical residential depth is 8-12m)
- DO NOT forget to generate separate roof elements for different building sections

When multiple images are provided, cross-reference them:
- Front photo shows window count and door placement
- Side photos reveal building depth and side windows
- Rear photos show back doors, windows, and any extensions

## Depth Map Images (AI-Generated Depth Estimation)

Some images may be accompanied by a corresponding **grayscale depth map** generated by a monocular depth estimation model (Depth Anything V2). When provided:

### How to Read Depth Maps
- **Darker pixels = closer** to the camera, **lighter pixels = farther** from the camera
- The depth map has the same resolution and pixel alignment as the original photo
- Depth values are **relative** (not absolute meters), so use them for proportional reasoning

### How to Use Depth Maps for Better 3D Inference
1. **Building depth estimation**: The depth gradient across the building facade reveals how deep the structure extends. A strong gradient from dark (front wall) to light (rear) indicates significant depth.
2. **Setbacks and recesses**: Areas where the depth map suddenly gets lighter indicate walls that are set back from the main facade — use these to model L-shapes, recessed entries, or stepped footprints.
3. **Protruding elements**: Areas darker than the main facade indicate elements that protrude forward — porches, bay windows, chimneys, or extensions.
4. **Roof slope direction**: The depth gradient across the roof reveals which direction it slopes and how steep it is. A uniform gradient suggests a single-slope roof; a V-shaped gradient suggests a gable.
5. **Relative wall positions**: Compare depth values between different parts of the facade to determine which walls are coplanar and which are offset in the Z-axis.
6. **Window and door depth**: Doors and windows appear slightly different in depth from the surrounding wall — use this to confirm their positions.

### Combining Depth Maps with Visual Cues
- Use the depth map to VALIDATE your visual estimates, not replace them
- If the depth map shows the building is deeper than a simple rectangle, model the extra depth
- Cross-reference depth discontinuities with architectural features (wings, bump-outs, porches)

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
  depthMaps?: Array<{ base64: string } | null>,
): Promise<AiGenerateResult> {
  const images = await Promise.all(imageFiles.map(fileToBase64));

  const imageCount = images.length;
  const hasDepthMaps = depthMaps?.some((d) => d != null) ?? false;
  const multiImageNote =
    imageCount > 1
      ? ` You have been provided ${imageCount} images of the same building from different angles/views. Cross-reference ALL images to get the most accurate and complete building model. Look for details visible in one image but not another (e.g., side windows, rear doors, upper floor layout).`
      : "";
  const depthMapNote = hasDepthMaps
    ? " Each building photo is followed by its AI-generated depth map (grayscale: darker = closer, lighter = farther). Use the depth maps to improve your 3D dimension estimates, especially building depth, setbacks, and protruding elements."
    : "";

  const userText = scaleHint
    ? `Analyze ${imageCount > 1 ? "these images" : "this image"} and generate BIM elements for the COMPLETE building (all floors, roof, stairs, structural elements) as a JSON array.${multiImageNote}${depthMapNote} Scale hint: ${scaleHint}. Use the thinking block for all your reasoning and analysis. Respond with ONLY the JSON array.`
    : `Analyze ${imageCount > 1 ? "these images" : "this image"} and generate BIM elements for the COMPLETE building (all floors, roof, stairs, structural elements) as a JSON array.${multiImageNote}${depthMapNote} Estimate reasonable dimensions in meters based on typical residential/commercial proportions. Use the thinking block for all your reasoning and analysis. Respond with ONLY the JSON array.`;

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  // Build content array with all images, each followed by its depth map if available
  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];
  for (let i = 0; i < images.length; i++) {
    const { data, mediaType } = images[i];
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data },
    });
    // Attach depth map right after its source image
    const depthMap = depthMaps?.[i];
    if (depthMap) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: depthMap.base64,
        },
      });
    }
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
