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
  type: "cloud" | "arrow" | "callout" | "text";
  coords: { x: number; y: number; width?: number; height?: number };
  comment: string;
  status: "open" | "resolved" | "pending";
  linkedBimGuid?: string;
  linkedElementName?: string;
  createdAt: number;
}

export type AnnotationTool = "select" | "cloud" | "arrow" | "callout" | "text";

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
  | "shelving";

export type CreationTool = "none" | BimElementType;

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
};
