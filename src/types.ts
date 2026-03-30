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
  | "measurement";

/** Handle exposed by Viewer3D via forwardRef for programmatic camera control */
export interface Viewer3DHandle {
  flyToElement: (globalId: string) => void;
}

// ── BIM Authoring ──────────────────────────────────────────────

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
  | "lightFixture";

export type CreationTool = "none" | BimElementType | "gridline";

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
  /** Y-axis rotation in radians (used by doors to align with host wall) */
  rotation?: number;
  /** ID of the wall this element is hosted on (doors) */
  hostWallId?: string;
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
};

// ── Undo/Redo ──────────────────────────────────────────────────

export type UndoAction =
  | { type: "add"; element: BimElement }
  | { type: "delete"; element: BimElement }
  | {
      type: "update";
      id: string;
      before: Partial<BimElement>;
      after: Partial<BimElement>;
    }
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
