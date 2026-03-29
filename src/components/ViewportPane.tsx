import { useRef } from "react";
import type {
  AnnotationTool,
  BimElement,
  CreationTool,
  GridSize,
  Markup,
  SelectedElement,
  SpatialNode,
  Viewer3DHandle,
  ViewPane,
  ViewPaneType,
} from "@/types";
import { CAMERA_PRESETS, DEFAULT_PARAMS } from "@/types";
import AnnotationLayer from "./AnnotationLayer";
import PdfViewer from "./PdfViewer";
import Viewer3D from "./Viewer3D";

interface ViewportPaneProps {
  pane: ViewPane;
  onClose: (id: string) => void;
  onChangeType: (id: string, type: ViewPaneType) => void;
  canClose: boolean;
  // 3D viewer props
  viewer3DRef?: React.Ref<Viewer3DHandle>;
  onModelLoaded: (tree: SpatialNode[]) => void;
  onElementSelected: (element: SelectedElement | null) => void;
  creationTool: CreationTool;
  onElementCreated: (element: BimElement) => void;
  bimElements: BimElement[];
  snapEnabled: boolean;
  gridSize: GridSize;
  // 2D PDF props
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  onPageChange: (page: number, total: number) => void;
  hasPdf: boolean;
  activeTool: AnnotationTool;
  onMarkupCreated: (markup: Omit<Markup, "id" | "createdAt">) => void;
  currentPage: number;
  selectedElement: SelectedElement | null;
}

const VIEW_TYPE_OPTIONS: { value: ViewPaneType; label: string }[] = [
  { value: "3d", label: "3D View" },
  { value: "plan", label: "Plan View" },
  { value: "front-elevation", label: "Front Elevation" },
  { value: "back-elevation", label: "Back Elevation" },
  { value: "left-elevation", label: "Left Elevation" },
  { value: "right-elevation", label: "Right Elevation" },
  { value: "2d-sheet", label: "2D Sheet" },
];

function PaneIcon({ type }: { type: ViewPaneType }) {
  if (type === "2d-sheet") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="8" x2="21" y2="8" />
        <line x1="7" y1="3" x2="7" y2="21" />
      </svg>
    );
  }
  if (type === "plan") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }
  if (type.includes("elevation")) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="6" width="18" height="14" rx="1" />
        <path d="M3 12 L12 6 L21 12" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z" />
      <path d="M12 2 L12 22" />
      <path d="M2 8 L22 8" opacity="0.4" />
    </svg>
  );
}

export default function ViewportPane({
  pane,
  onClose,
  onChangeType,
  canClose,
  viewer3DRef,
  onModelLoaded,
  onElementSelected,
  creationTool,
  onElementCreated,
  bimElements,
  snapEnabled,
  gridSize,
  pdfCanvasRef,
  onPageChange,
  hasPdf,
  activeTool,
  onMarkupCreated,
  currentPage,
  selectedElement,
}: ViewportPaneProps) {
  const localPdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const effectivePdfRef = pdfCanvasRef ?? localPdfCanvasRef;

  const is3DType = pane.type !== "2d-sheet";
  const cameraPreset = is3DType ? CAMERA_PRESETS[pane.type] : undefined;

  return (
    <div className="viewport-pane">
      {/* Pane header */}
      <div className="viewport-pane-header">
        <div className="viewport-pane-header-left">
          <PaneIcon type={pane.type} />
          <select
            className="viewport-pane-type-select"
            value={pane.type}
            onChange={(e) =>
              onChangeType(pane.id, e.target.value as ViewPaneType)
            }
          >
            {VIEW_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {canClose && (
          <button
            type="button"
            className="viewport-pane-close"
            onClick={() => onClose(pane.id)}
            title="Close pane"
          >
            <svg
              viewBox="0 0 16 16"
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Pane content */}
      <div className="viewport-pane-content">
        {is3DType ? (
          <Viewer3D
            ref={viewer3DRef}
            onModelLoaded={onModelLoaded}
            onElementSelected={onElementSelected}
            creationTool={creationTool}
            onElementCreated={onElementCreated}
            bimElements={bimElements}
            defaultParams={DEFAULT_PARAMS}
            snapEnabled={snapEnabled}
            gridSize={gridSize}
            cameraPreset={cameraPreset}
          />
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex-1 relative overflow-hidden">
              <PdfViewer
                onPageChange={onPageChange}
                canvasRef={effectivePdfRef}
              />
              {hasPdf && (
                <AnnotationLayer
                  activeTool={activeTool}
                  pdfCanvasRef={effectivePdfRef}
                  onMarkupCreated={onMarkupCreated}
                  currentPage={currentPage}
                  selectedElement={selectedElement}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
