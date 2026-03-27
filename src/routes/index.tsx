import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import AnnotationLayer from "@/components/AnnotationLayer";
import AnnotationToolbar from "@/components/AnnotationToolbar";
import PdfViewer from "@/components/PdfViewer";
import Sidebar from "@/components/Sidebar";
import Viewer3D from "@/components/Viewer3D";
import type {
  AnnotationTool,
  Markup,
  SelectedElement,
  SpatialNode,
} from "@/types";

export const Route = createFileRoute("/")({
  component: Home,
});

type ViewMode = "split" | "3d" | "2d";

function Home() {
  const [tree, setTree] = useState<SpatialNode[]>([]);
  const [selectedElement, setSelectedElement] =
    useState<SelectedElement | null>(null);
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("select");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasPdf, setHasPdf] = useState(false);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleModelLoaded = useCallback((spatialTree: SpatialNode[]) => {
    setTree(spatialTree);
  }, []);

  const handleElementSelected = useCallback(
    (element: SelectedElement | null) => {
      setSelectedElement(element);
    },
    [],
  );

  const handlePageChange = useCallback((page: number, _total: number) => {
    setCurrentPage(page);
    setHasPdf(true);
  }, []);

  const handleMarkupCreated = useCallback(
    (markup: Omit<Markup, "id" | "createdAt">) => {
      const newMarkup: Markup = {
        ...markup,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      setMarkups((prev) => [...prev, newMarkup]);
    },
    [],
  );

  const handleMarkupStatusChange = useCallback(
    (id: string, status: Markup["status"]) => {
      setMarkups((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status } : m)),
      );
    },
    [],
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        tree={tree}
        selectedElement={selectedElement}
        markups={markups}
        onMarkupStatusChange={handleMarkupStatusChange}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* View mode toggle */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/60 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-1">
            {(["split", "3d", "2d"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                {mode === "split" ? "Split" : mode.toUpperCase()}
              </button>
            ))}
          </div>
          {hasPdf && (
            <span className="text-[10px] text-slate-500">
              Page {currentPage}
            </span>
          )}
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* 3D Viewer */}
          {(viewMode === "split" || viewMode === "3d") && (
            <div
              className={`${viewMode === "split" ? "w-1/2 border-r border-slate-700" : "flex-1"} h-full`}
            >
              <Viewer3D
                onModelLoaded={handleModelLoaded}
                onElementSelected={handleElementSelected}
              />
            </div>
          )}

          {/* 2D PDF Viewer */}
          {(viewMode === "split" || viewMode === "2d") && (
            <div
              className={`${viewMode === "split" ? "w-1/2" : "flex-1"} h-full flex flex-col`}
            >
              <AnnotationToolbar
                activeTool={activeTool}
                onToolChange={setActiveTool}
                hasPdf={hasPdf}
              />
              <div className="flex-1 relative overflow-hidden">
                <PdfViewer
                  onPageChange={handlePageChange}
                  canvasRef={pdfCanvasRef}
                />
                {hasPdf && (
                  <AnnotationLayer
                    activeTool={activeTool}
                    pdfCanvasRef={pdfCanvasRef}
                    onMarkupCreated={handleMarkupCreated}
                    currentPage={currentPage}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
