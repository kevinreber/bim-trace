export interface SpatialNode {
  expressID: number;
  type: string;
  name: string;
  children: SpatialNode[];
}

export interface SelectedElement {
  expressID: number;
  globalId: string;
  type: string;
  name: string;
  properties: Record<string, string | number | boolean>;
}

export interface Markup {
  id: string;
  pageNumber: number;
  type: MarkupType;
  coords: { x: number; y: number; width?: number; height?: number };
  comment: string;
  status: "open" | "resolved" | "pending";
  linkedBimGuid?: string;
  linkedElementName?: string;
  createdAt: number;
  color?: string;
}

export type MarkupType =
  | "cloud"
  | "arrow"
  | "callout"
  | "text"
  | "freehand"
  | "rectangle"
  | "circle"
  | "polyline"
  | "highlight"
  | "measurement";

export type AnnotationTool =
  | "select"
  | "cloud"
  | "arrow"
  | "callout"
  | "text"
  | "freehand"
  | "rectangle"
  | "circle"
  | "polyline"
  | "highlight"
  | "measurement"
  | "keynote"
  | "detailLine"
  | "filledRegion";

// ── Keynotes ───────────────────────────────────────────────

export interface Keynote {
  id: string;
  key: string; // e.g., "01.A"
  text: string; // e.g., "Concrete masonry unit"
  category: string; // e.g., "Materials"
}

export const DEFAULT_KEYNOTES: Keynote[] = [
  {
    id: "k1",
    key: "01.A",
    text: "Concrete masonry unit",
    category: "Materials",
  },
  {
    id: "k2",
    key: "01.B",
    text: "Cast-in-place concrete",
    category: "Materials",
  },
  {
    id: "k3",
    key: "02.A",
    text: "Structural steel beam",
    category: "Structural",
  },
  { id: "k4", key: "02.B", text: "Steel column", category: "Structural" },
  { id: "k5", key: "03.A", text: "Gypsum wallboard", category: "Finishes" },
  { id: "k6", key: "03.B", text: "Ceramic tile", category: "Finishes" },
  {
    id: "k7",
    key: "04.A",
    text: "Hollow metal door frame",
    category: "Openings",
  },
  {
    id: "k8",
    key: "04.B",
    text: "Aluminum window frame",
    category: "Openings",
  },
  { id: "k9", key: "05.A", text: "Built-up roofing", category: "Roofing" },
  {
    id: "k10",
    key: "05.B",
    text: "Standing seam metal roof",
    category: "Roofing",
  },
];

/** Handle exposed by Viewer3D via forwardRef for programmatic camera control */
export interface Viewer3DHandle {
  flyToElement: (globalId: string) => void;
  flyToLevel: (height: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  /** Move the camera to look at the current target from the given direction (used by the ViewCube). */
  setViewDirection: (dir: [number, number, number]) => void;
}

// ── BIM Authoring ──────────────────────────────────────────────

export type BimMaterialType =
  | "concrete"
  | "wood"
  | "steel"
  | "glass"
  | "brick"
  | "stone"
  | "drywall"
  | "aluminum";

export type BimElementType =
  | "wall"
  | "column"
  | "slab"
  | "door"
  | "window"
  | "beam"
  | "ceiling"
  | "roof"
  | "stair"
  | "railing"
  | "curtainWall"
  | "table"
  | "chair"
  | "shelving"
  | "desk"
  | "toilet"
  | "sink"
  | "duct"
  | "pipe"
  | "lightFixture"
  | "room";

export type CreationTool =
  | "none"
  | BimElementType
  | "gridline"
  | "dimension3d"
  | "spotElevation";

/** Construction phase for phasing/demolition tracking */
export type BimPhase = "existing" | "new" | "demolished" | "temporary";

export interface BimElementParams {
  wall: { height: number; thickness: number };
  column: { height: number; radius: number };
  slab: { thickness: number };
  door: { height: number; width: number };
  window: { height: number; width: number; sillHeight: number };
  beam: { height: number; width: number };
  ceiling: { thickness: number };
  roof: { height: number; thickness: number; overhang: number };
  stair: {
    riserHeight: number;
    treadDepth: number;
    width: number;
    numRisers: number;
  };
  railing: { height: number; postSpacing: number };
  curtainWall: {
    height: number;
    panelWidth: number;
    panelHeight: number;
    mullionSize: number;
  };
  table: { height: number; width: number; depth: number };
  chair: { height: number; width: number; depth: number };
  shelving: { height: number; width: number; depth: number };
  desk: { height: number; width: number; depth: number; lShaped: boolean };
  toilet: { height: number; width: number; depth: number };
  sink: { height: number; width: number; depth: number };
  duct: { height: number; width: number };
  pipe: { diameter: number };
  lightFixture: { width: number; depth: number };
  room: { height: number };
}

export interface BimElement {
  id: string;
  type: BimElementType;
  name: string;
  /** Start point on the ground plane (world coords) */
  start: { x: number; z: number };
  /** End point — used by wall and slab; same as start for column/door */
  end: { x: number; z: number };
  /** Parametric dimensions */
  params: BimElementParams[BimElementType];
  /** Floor level (Y offset) */
  level: number;
  /** Group ID if element belongs to a group */
  groupId?: string;
  /** Y-axis rotation in radians (used by doors to align with host wall) */
  rotation?: number;
  /** ID of the wall this element is hosted on (doors) */
  hostWallId?: string;
  /** Optional material override; falls back to type default if omitted */
  material?: BimMaterialType;
  /** When true, element cannot be moved, rotated, or deleted */
  pinned?: boolean;
  /** Construction phase: existing, new, demolished, temporary */
  phase?: BimPhase;
}

/** Default parametric values for each element type */
export const DEFAULT_PARAMS: BimElementParams = {
  wall: { height: 3, thickness: 0.2 },
  column: { height: 3, radius: 0.15 },
  slab: { thickness: 0.25 },
  door: { height: 2.1, width: 0.9 },
  window: { height: 1.2, width: 1.0, sillHeight: 0.9 },
  beam: { height: 0.4, width: 0.3 },
  ceiling: { thickness: 0.15 },
  roof: { height: 2.5, thickness: 0.2, overhang: 0.3 },
  stair: { riserHeight: 0.18, treadDepth: 0.28, width: 1.0, numRisers: 14 },
  railing: { height: 1.0, postSpacing: 1.2 },
  curtainWall: {
    height: 3.5,
    panelWidth: 1.2,
    panelHeight: 1.5,
    mullionSize: 0.06,
  },
  table: { height: 0.75, width: 1.2, depth: 0.8 },
  chair: { height: 0.9, width: 0.45, depth: 0.45 },
  shelving: { height: 1.8, width: 1.0, depth: 0.4 },
  desk: { height: 0.75, width: 1.5, depth: 0.7, lShaped: false },
  toilet: { height: 0.42, width: 0.38, depth: 0.7 },
  sink: { height: 0.85, width: 0.5, depth: 0.4 },
  duct: { height: 0.3, width: 0.4 },
  pipe: { diameter: 0.1 },
  lightFixture: { width: 0.6, depth: 0.6 },
  room: { height: 3 },
};

/** Default material for each element type (used when element.material is unset) */
export const DEFAULT_ELEMENT_MATERIAL: Record<BimElementType, BimMaterialType> =
  {
    wall: "concrete",
    column: "concrete",
    slab: "concrete",
    door: "wood",
    window: "glass",
    beam: "steel",
    ceiling: "drywall",
    roof: "wood",
    stair: "concrete",
    railing: "steel",
    curtainWall: "glass",
    table: "wood",
    chair: "wood",
    shelving: "wood",
    desk: "wood",
    toilet: "drywall",
    sink: "drywall",
    duct: "aluminum",
    pipe: "steel",
    lightFixture: "aluminum",
    room: "drywall",
  };

// ── Undo/Redo ──────────────────────────────────────────────────

export type UndoAction =
  | { type: "add"; element: BimElement }
  | { type: "delete"; element: BimElement }
  | { type: "bulkDelete"; elements: BimElement[] }
  | {
      type: "update";
      id: string;
      before: Partial<BimElement>;
      after: Partial<BimElement>;
    }
  | { type: "batchAdd"; elements: BimElement[] }
  | { type: "addMarkup"; markup: Markup }
  | { type: "deleteMarkup"; markup: Markup }
  | {
      type: "updateMarkup";
      id: string;
      before: Partial<Markup>;
      after: Partial<Markup>;
    };

// ── Multi-Window Views ──────────────────────────────────────────

export type ViewPaneType =
  | "3d"
  | "plan"
  | "front-elevation"
  | "back-elevation"
  | "left-elevation"
  | "right-elevation"
  | "section"
  | "2d-sheet";

export interface ViewPane {
  id: string;
  type: ViewPaneType;
  title: string;
}

export type ViewLayout = "single" | "2-up" | "3-up" | "4-up";

export const VIEW_PANE_LABELS: Record<ViewPaneType, string> = {
  "3d": "3D View",
  plan: "Plan View",
  "front-elevation": "Front Elevation",
  "back-elevation": "Back Elevation",
  "left-elevation": "Left Elevation",
  "right-elevation": "Right Elevation",
  section: "Section",
  "2d-sheet": "2D Sheet",
};

export const DEFAULT_PANES: ViewPane[] = [
  { id: "main-3d", type: "3d", title: "3D View" },
];

// ── Camera Presets for Orthographic Views ────────────────────

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
  orthographic: boolean;
  /** Optional clipping plane for section views */
  sectionPlane?: {
    normal: [number, number, number];
    point: [number, number, number];
  };
}

export const CAMERA_PRESETS: Record<string, CameraPreset> = {
  "3d": {
    position: [12, 6, 8],
    target: [0, 0, -10],
    orthographic: false,
  },
  plan: {
    position: [0, 50, 0],
    target: [0, 0, 0],
    orthographic: true,
  },
  "front-elevation": {
    position: [0, 5, 50],
    target: [0, 5, 0],
    orthographic: true,
  },
  "back-elevation": {
    position: [0, 5, -50],
    target: [0, 5, 0],
    orthographic: true,
  },
  "left-elevation": {
    position: [-50, 5, 0],
    target: [0, 5, 0],
    orthographic: true,
  },
  "right-elevation": {
    position: [50, 5, 0],
    target: [0, 5, 0],
    orthographic: true,
  },
  section: {
    position: [0, 5, 50],
    target: [0, 5, 0],
    orthographic: true,
    sectionPlane: {
      normal: [0, 0, -1],
      point: [0, 0, 0],
    },
  },
};

// ── Gridlines (user-created reference lines) ────────────────

export interface GridLine {
  id: string;
  label: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
}

export type WallAlignMode = "left" | "center" | "right";

// ── 3D Dimension Lines ──────────────────────────────────────

export interface Dimension3D {
  id: string;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  distance: number;
}

// ── Spot Elevations ────────────────────────────────────────

export interface SpotElevation {
  id: string;
  position: { x: number; y: number; z: number };
  elevation: number;
}

// ── Visibility / Graphics Overrides ─────────────────────────

export interface CategoryVisibility {
  visible: boolean;
  wireframe: boolean;
  transparency: number; // 0–1
}

// ── Element Groups ──────────────────────────────────────────

export interface ElementGroup {
  id: string;
  name: string;
  elementIds: string[];
}

// ── Saved / Named Views ─────────────────────────────────────

export interface SavedView {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  orthographic: boolean;
}

// ── Detail Level ───────────────────────────────────────────

export type DetailLevel = "coarse" | "medium" | "fine";

// ── View Templates ─────────────────────────────────────────

export interface ViewTemplate {
  id: string;
  name: string;
  detailLevel: DetailLevel;
  colorBy: ViewFilterColorBy;
  categoryVisibility: Record<string, CategoryVisibility>;
}

// ── Section Box ────────────────────────────────────────────

export interface SectionBox {
  enabled: boolean;
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

// ── View Filters ───────────────────────────────────────────

export type ViewFilterColorBy =
  | "none"
  | "type"
  | "level"
  | "phase"
  | "material";

/** Color palette for view filter visualization */
export const VIEW_FILTER_COLORS: Record<string, number> = {
  wall: 0xe8e0d4,
  column: 0xc0c0c0,
  slab: 0xbab5ab,
  door: 0xf59e0b,
  window: 0x3b82f6,
  beam: 0xa0a0a0,
  ceiling: 0xf5f5f0,
  roof: 0x8b4513,
  stair: 0xc8b89a,
  railing: 0x404040,
  curtainWall: 0x6ec6e6,
  table: 0x8b5e3c,
  chair: 0x6b4226,
  shelving: 0x9e7c4f,
  desk: 0x7a5c3c,
  toilet: 0xf0f0f0,
  sink: 0xf5f5f5,
  duct: 0x808080,
  pipe: 0x606060,
  lightFixture: 0xe0e0e0,
  room: 0x93c5fd,
  // Phase colors
  existing: 0x888888,
  new: 0x4ade80,
  demolished: 0xff4444,
  temporary: 0xfbbf24,
  // Level colors (generated dynamically)
};

// ── Sheet Composition ──────────────────────────────────────

export interface SheetViewport {
  id: string;
  viewName: string;
  x: number; // position on sheet (mm)
  y: number;
  width: number;
  height: number;
  scale: string; // e.g., "1:100"
}

export interface Sheet {
  id: string;
  number: string; // e.g., "A101"
  name: string;
  titleBlock: "standard" | "minimal";
  viewports: SheetViewport[];
}

// ── Design Options ─────────────────────────────────────────

export interface DesignOption {
  id: string;
  name: string;
  description: string;
  elementIds: string[];
  active: boolean;
}

// ── Topography ─────────────────────────────────────────────

export interface TerrainPoint {
  x: number;
  z: number;
  elevation: number;
}

export interface Topography {
  id: string;
  name: string;
  points: TerrainPoint[];
  gridSize: number; // spacing between points
}

// ── Worksharing / Worksets ─────────────────────────────────

export interface Workset {
  id: string;
  name: string;
  owner: string; // user who owns this workset
  editable: boolean; // whether current user can edit
  elementIds: string[];
}

// ── Parametric Constraints ─────────────────────────────────

export type ConstraintType = "distance" | "alignment" | "equality";

export interface BimConstraint {
  id: string;
  type: ConstraintType;
  elementIds: string[]; // elements involved
  axis?: "x" | "z"; // for alignment constraints
  value?: number; // for distance constraints (target distance)
}

// ── Schedule View ───────────────────────────────────────────

export type ScheduleType = "door" | "window" | "room" | "wall" | "all";

// ── Snap & Grid ──────────────────────────────────────────────

export type GridSize = 0.25 | 0.5 | 1;

// ── Level Manager ──────────────────────────────────────────────

export interface Level {
  id: string;
  name: string;
  height: number;
  visible: boolean;
}

export const DEFAULT_LEVELS: Level[] = [
  { id: "ground", name: "Ground", height: 0, visible: true },
  { id: "level-1", name: "Level 1", height: 3, visible: true },
  { id: "level-2", name: "Level 2", height: 6, visible: true },
  { id: "roof", name: "Roof", height: 9, visible: true },
];

// ── Unit System ────────────────────────────────────────────────

export type UnitSystem = "metric" | "imperial";

const M_TO_FT = 3.28084;

/** Convert an internal value (meters) to display value in the given unit. */
export function toDisplayUnit(meters: number, unit: UnitSystem): number {
  return unit === "imperial" ? meters * M_TO_FT : meters;
}

/** Convert a display value back to internal meters. */
export function fromDisplayUnit(value: number, unit: UnitSystem): number {
  return unit === "imperial" ? value / M_TO_FT : value;
}

/** Short label for the active unit system. */
export function unitLabel(unit: UnitSystem): string {
  return unit === "imperial" ? "ft" : "m";
}

/** Format a value for display with appropriate precision. */
export function formatUnit(meters: number, unit: UnitSystem): string {
  const val = toDisplayUnit(meters, unit);
  const decimals = unit === "imperial" ? 1 : 1;
  return `${val.toFixed(decimals)} ${unitLabel(unit)}`;
}
