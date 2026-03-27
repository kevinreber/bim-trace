import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import AnnotationLayer from "@/components/AnnotationLayer";
import AnnotationToolbar from "@/components/AnnotationToolbar";
import CreationToolbar from "@/components/CreationToolbar";
import PdfViewer from "@/components/PdfViewer";
import Sidebar from "@/components/Sidebar";
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
      // Apply active level height
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
      // Don't capture when typing in inputs
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

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        tree={tree}
        selectedElement={selectedElement}
        markups={markups}
        onMarkupStatusChange={handleMarkupStatusChange}
        onMarkupNavigate={handleMarkupNavigate}
        onMarkupLink={handleMarkupLink}
        bimElements={bimElements}
        onBimElementUpdate={handleBimElementUpdate}
        onBimElementDelete={handleBimElementDelete}
        levels={levels}
        activeLevel={activeLevel}
        onActiveLevelChange={setActiveLevel}
        onLevelsChange={setLevels}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top toolbar */}
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
                title={`${mode === "split" ? "Split" : mode.toUpperCase()} (${mode === "split" ? "1" : mode === "3d" ? "2" : "3"})`}
              >
                {mode === "split" ? "Split" : mode.toUpperCase()}
              </button>
            ))}

            <div className="w-px h-5 bg-slate-600 mx-1" />

            {/* Undo/Redo */}
            <button
              type="button"
              onClick={handleUndo}
              className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={handleRedo}
              className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
              title="Redo (Ctrl+Y)"
            >
              Redo
            </button>

            <div className="w-px h-5 bg-slate-600 mx-1" />

            {/* Snap-to-grid */}
            <button
              type="button"
              onClick={() => setSnapEnabled((prev) => !prev)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                snapEnabled
                  ? "bg-amber-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
              title="Toggle snap-to-grid (G)"
            >
              Snap
            </button>
            {snapEnabled && (
              <select
                value={gridSize}
                onChange={(e) =>
                  setGridSize(Number.parseFloat(e.target.value) as GridSize)
                }
                className="px-1 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 border border-slate-600"
              >
                <option value={0.25}>0.25m</option>
                <option value={0.5}>0.5m</option>
                <option value={1}>1m</option>
              </select>
            )}

            <div className="w-px h-5 bg-slate-600 mx-1" />

            {/* Level selector */}
            <span className="text-[10px] text-slate-500 mr-1">Level:</span>
            <select
              value={activeLevel}
              onChange={(e) => setActiveLevel(e.target.value)}
              className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-slate-300 border border-slate-600"
            >
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name} ({level.height}m)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {bimElements.length > 0 && (
              <span className="text-[10px] text-green-500">
                {bimElements.length} element
                {bimElements.length !== 1 ? "s" : ""}
              </span>
            )}
            {hasPdf && (
              <span className="text-[10px] text-slate-500">
                Page {currentPage}
              </span>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* 3D Viewer */}
          {(viewMode === "split" || viewMode === "3d") && (
            <div
              className={`${viewMode === "split" ? "w-1/2 border-r border-slate-700" : "flex-1"} h-full relative`}
            >
              <CreationToolbar
                activeTool={creationTool}
                onToolChange={setCreationTool}
              />
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
                    selectedElement={selectedElement}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg animate-slide-in ${
                toast.type === "success"
                  ? "bg-green-800/90 text-green-200 border border-green-700"
                  : toast.type === "error"
                    ? "bg-red-800/90 text-red-200 border border-red-700"
                    : "bg-slate-800/90 text-slate-200 border border-slate-700"
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}

      {/* Keyboard shortcuts hint (shown briefly) */}
      <div className="fixed bottom-4 left-4 z-40 text-[9px] text-slate-600 hidden lg:block">
        Shift+Key = Create tool | G = Grid snap | 1/2/3 = View | Ctrl+Z/Y =
        Undo/Redo
      </div>
    </div>
  );
}
