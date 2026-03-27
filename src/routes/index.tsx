import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import AnnotationLayer from "@/components/AnnotationLayer";
import PdfViewer from "@/components/PdfViewer";
import RibbonToolbar from "@/components/RibbonToolbar";
import { ProjectBrowser, PropertiesPanel } from "@/components/Sidebar";
import Viewer3D from "@/components/Viewer3D";
import type {
  AnnotationTool,
  BimElement,
  CreationTool,
  GridSize,
  Level,
  Markup,
  SelectedElement,
  SpatialNode,
  UndoAction,
  Viewer3DHandle,
} from "@/types";
import { DEFAULT_LEVELS, DEFAULT_PARAMS } from "@/types";

export const Route = createFileRoute("/")({
  component: Home,
});

type ViewMode = "split" | "3d" | "2d";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

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
  const viewer3DRef = useRef<Viewer3DHandle>(null);

  // BIM authoring state
  const [creationTool, setCreationTool] = useState<CreationTool>("none");
  const [bimElements, setBimElements] = useState<BimElement[]>([]);

  // Undo/Redo
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);

  // Snap-to-grid
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [gridSize, setGridSize] = useState<GridSize>(0.5);

  // Level management
  const [levels, setLevels] = useState<Level[]>(DEFAULT_LEVELS);
  const [activeLevel, setActiveLevel] = useState<string>("ground");

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: Toast["type"] = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    [],
  );

  const activeLevelHeight =
    levels.find((l) => l.id === activeLevel)?.height ?? 0;

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
      undoStackRef.current.push({ type: "addMarkup", markup: newMarkup });
      redoStackRef.current = [];
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

  const handleMarkupNavigate = useCallback((markup: Markup) => {
    if (!markup.linkedBimGuid) return;
    viewer3DRef.current?.flyToElement(markup.linkedBimGuid);
    setViewMode((prev) => (prev === "2d" ? "split" : prev));
  }, []);

  const handleMarkupLink = useCallback(
    (markupId: string) => {
      setMarkups((prev) =>
        prev.map((m) => {
          if (m.id !== markupId) return m;
          if (m.linkedBimGuid) {
            return {
              ...m,
              linkedBimGuid: undefined,
              linkedElementName: undefined,
            };
          }
          if (selectedElement) {
            return {
              ...m,
              linkedBimGuid: selectedElement.globalId,
              linkedElementName: selectedElement.name,
            };
          }
          return m;
        }),
      );
    },
    [selectedElement],
  );

  // BIM authoring callbacks
  const handleElementCreated = useCallback(
    (element: BimElement) => {
      const el = { ...element, level: activeLevelHeight };
      setBimElements((prev) => [...prev, el]);
      undoStackRef.current.push({ type: "add", element: el });
      redoStackRef.current = [];
      showToast(`Created ${el.type}: ${el.name}`, "success");
    },
    [activeLevelHeight, showToast],
  );

  const handleBimElementUpdate = useCallback(
    (id: string, updates: Partial<BimElement>) => {
      setBimElements((prev) => {
        const old = prev.find((el) => el.id === id);
        if (old) {
          const before: Partial<BimElement> = {};
          for (const key of Object.keys(updates) as (keyof BimElement)[]) {
            (before as Record<string, unknown>)[key] = old[key];
          }
          undoStackRef.current.push({
            type: "update",
            id,
            before,
            after: updates,
          });
          redoStackRef.current = [];
        }
        return prev.map((el) => (el.id === id ? { ...el, ...updates } : el));
      });
    },
    [],
  );

  const handleBimElementDelete = useCallback(
    (id: string) => {
      setBimElements((prev) => {
        const el = prev.find((e) => e.id === id);
        if (el) {
          undoStackRef.current.push({ type: "delete", element: el });
          redoStackRef.current = [];
          showToast(`Deleted ${el.name}`, "info");
        }
        return prev.filter((e) => e.id !== id);
      });
      setSelectedElement((prev) => (prev?.globalId === id ? null : prev));
    },
    [showToast],
  );

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    const action = undoStackRef.current.pop();
    if (!action) return;

    switch (action.type) {
      case "add":
        setBimElements((prev) =>
          prev.filter((el) => el.id !== action.element.id),
        );
        break;
      case "delete":
        setBimElements((prev) => [...prev, action.element]);
        break;
      case "update":
        setBimElements((prev) =>
          prev.map((el) =>
            el.id === action.id ? { ...el, ...action.before } : el,
          ),
        );
        break;
      case "addMarkup":
        setMarkups((prev) => prev.filter((m) => m.id !== action.markup.id));
        break;
      case "deleteMarkup":
        setMarkups((prev) => [...prev, action.markup]);
        break;
      case "updateMarkup":
        setMarkups((prev) =>
          prev.map((m) =>
            m.id === action.id ? { ...m, ...action.before } : m,
          ),
        );
        break;
    }
    redoStackRef.current.push(action);
    showToast("Undo", "info");
  }, [showToast]);

  const handleRedo = useCallback(() => {
    const action = redoStackRef.current.pop();
    if (!action) return;

    switch (action.type) {
      case "add":
        setBimElements((prev) => [...prev, action.element]);
        break;
      case "delete":
        setBimElements((prev) =>
          prev.filter((el) => el.id !== action.element.id),
        );
        break;
      case "update":
        setBimElements((prev) =>
          prev.map((el) =>
            el.id === action.id ? { ...el, ...action.after } : el,
          ),
        );
        break;
      case "addMarkup":
        setMarkups((prev) => [...prev, action.markup]);
        break;
      case "deleteMarkup":
        setMarkups((prev) => prev.filter((m) => m.id !== action.markup.id));
        break;
      case "updateMarkup":
        setMarkups((prev) =>
          prev.map((m) => (m.id === action.id ? { ...m, ...action.after } : m)),
        );
        break;
    }
    undoStackRef.current.push(action);
    showToast("Redo", "info");
  }, [showToast]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      )
        return;

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Delete selected element
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElement) {
          const bimEl = bimElements.find(
            (el) => el.id === selectedElement.globalId,
          );
          if (bimEl) {
            e.preventDefault();
            handleBimElementDelete(bimEl.id);
          }
        }
        return;
      }

      // View mode shortcuts
      if (e.key === "1") {
        setViewMode("split");
        return;
      }
      if (e.key === "2") {
        setViewMode("3d");
        return;
      }
      if (e.key === "3") {
        setViewMode("2d");
        return;
      }

      // Snap-to-grid toggle
      if (e.key === "g") {
        setSnapEnabled((prev) => !prev);
        return;
      }

      // Escape — deselect tool
      if (e.key === "Escape") {
        setCreationTool("none");
        setActiveTool("select");
        return;
      }

      // Creation tool shortcuts (Shift + letter)
      if (e.shiftKey) {
        const toolMap: Record<string, CreationTool> = {
          W: "wall",
          C: "column",
          S: "slab",
          B: "beam",
          D: "door",
          N: "window",
          G: "ceiling",
          R: "roof",
          A: "stair",
          I: "railing",
          K: "curtainWall",
          T: "table",
          H: "chair",
          L: "shelving",
          E: "desk",
          O: "toilet",
          J: "sink",
          U: "duct",
          P: "pipe",
          F: "lightFixture",
        };
        const tool = toolMap[e.key.toUpperCase()];
        if (tool) {
          e.preventDefault();
          setCreationTool(tool);
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    handleUndo,
    handleRedo,
    handleBimElementDelete,
    selectedElement,
    bimElements,
  ]);

  const activeLevelName =
    levels.find((l) => l.id === activeLevel)?.name ?? "Ground";

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* ── Ribbon Toolbar (top, full width — like Revit) ──────── */}
      <RibbonToolbar
        creationTool={creationTool}
        onCreationToolChange={setCreationTool}
        annotationTool={activeTool}
        onAnnotationToolChange={setActiveTool}
        hasPdf={hasPdf}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        snapEnabled={snapEnabled}
        onSnapToggle={() => setSnapEnabled((prev) => !prev)}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
        levels={levels}
        activeLevel={activeLevel}
        onActiveLevelChange={setActiveLevel}
      />

      {/* ── Main workspace: Browser | Viewport(s) | Properties ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Project Browser */}
        <div className="w-64 shrink-0">
          <ProjectBrowser
            tree={tree}
            bimElements={bimElements}
            markups={markups}
            selectedElement={selectedElement}
            onMarkupStatusChange={handleMarkupStatusChange}
            onMarkupNavigate={handleMarkupNavigate}
            onMarkupLink={handleMarkupLink}
            levels={levels}
            activeLevel={activeLevel}
            onActiveLevelChange={setActiveLevel}
            onLevelsChange={setLevels}
          />
        </div>

        {/* Center: Viewports */}
        <div className="flex-1 flex overflow-hidden">
          {/* 3D Viewer */}
          {(viewMode === "split" || viewMode === "3d") && (
            <div
              className={`${viewMode === "split" ? "w-1/2" : "flex-1"} h-full relative`}
              style={{
                borderRight:
                  viewMode === "split" ? "1px solid var(--border)" : undefined,
              }}
            >
              <Viewer3D
                ref={viewer3DRef}
                onModelLoaded={handleModelLoaded}
                onElementSelected={handleElementSelected}
                creationTool={creationTool}
                onElementCreated={handleElementCreated}
                bimElements={bimElements}
                defaultParams={DEFAULT_PARAMS}
                snapEnabled={snapEnabled}
                gridSize={gridSize}
              />
              {/* Viewport label (like Revit's viewport title) */}
              <div
                className="absolute top-2 left-2 z-10 px-2 py-1 rounded text-[10px] font-medium"
                style={{
                  background: "rgba(0,0,0,0.5)",
                  color: "var(--text-secondary)",
                }}
              >
                3D View
              </div>
            </div>
          )}

          {/* 2D PDF Viewer */}
          {(viewMode === "split" || viewMode === "2d") && (
            <div
              className={`${viewMode === "split" ? "w-1/2" : "flex-1"} h-full flex flex-col`}
            >
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
                    selectedElement={selectedElement}
                  />
                )}
                {/* Viewport label */}
                <div
                  className="absolute top-2 left-2 z-10 px-2 py-1 rounded text-[10px] font-medium"
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    color: "var(--text-secondary)",
                  }}
                >
                  2D Sheet
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right panel: Properties */}
        <div className="w-72 shrink-0">
          <PropertiesPanel
            selectedElement={selectedElement}
            bimElements={bimElements}
            markups={markups}
            onBimElementUpdate={handleBimElementUpdate}
            onBimElementDelete={handleBimElementDelete}
            onMarkupStatusChange={handleMarkupStatusChange}
            onMarkupNavigate={handleMarkupNavigate}
            onMarkupLink={handleMarkupLink}
          />
        </div>
      </div>

      {/* ── Status Bar (bottom, like Revit) ────────────────────── */}
      <div className="status-bar">
        <div className="status-bar-section">
          {creationTool !== "none" ? (
            <span className="status-indicator">
              <span className="status-dot green" />
              Creating: {creationTool} — Click to set start point
            </span>
          ) : activeTool !== "select" ? (
            <span className="status-indicator">
              <span className="status-dot blue" />
              Annotating: {activeTool}
            </span>
          ) : (
            <span>Ready</span>
          )}
        </div>
        <div className="status-bar-section">
          {snapEnabled && (
            <span className="status-indicator">
              <span className="status-dot amber" />
              Snap: {gridSize}m
            </span>
          )}
          <span className="status-indicator">
            <span className="status-dot blue" />
            Level: {activeLevelName} ({activeLevelHeight}m)
          </span>
          {bimElements.length > 0 && (
            <span className="status-indicator">
              <span className="status-dot green" />
              {bimElements.length} element{bimElements.length !== 1 ? "s" : ""}
            </span>
          )}
          {hasPdf && <span>Page {currentPage}</span>}
          <span style={{ color: "var(--text-muted)" }}>
            Shift+Key = Create | G = Snap | 1/2/3 = View
          </span>
        </div>
      </div>

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-8 right-4 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="animate-slide-in"
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                background:
                  toast.type === "success"
                    ? "rgba(76, 175, 80, 0.9)"
                    : toast.type === "error"
                      ? "rgba(244, 67, 54, 0.9)"
                      : "rgba(45, 45, 64, 0.95)",
                color: "white",
                border: `1px solid ${
                  toast.type === "success"
                    ? "#66bb6a"
                    : toast.type === "error"
                      ? "#ef5350"
                      : "var(--border)"
                }`,
              }}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
