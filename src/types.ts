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

export type BimElementType = "wall" | "column" | "slab" | "door";

export type CreationTool = "none" | BimElementType;

export interface BimElementParams {
  wall: { height: number; thickness: number };
  column: { height: number; radius: number };
  slab: { thickness: number };
  door: { height: number; width: number };
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
};
