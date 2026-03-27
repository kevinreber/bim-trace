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
