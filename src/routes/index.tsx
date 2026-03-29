import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import RibbonToolbar from "@/components/RibbonToolbar";
import { ProjectBrowser, PropertiesPanel } from "@/components/Sidebar";
import ViewportPane from "@/components/ViewportPane";
import {
  clearProject,
  exportProjectJSON,
  importProjectJSON,
  loadProject,
  type ProjectData,
  saveProject,
} from "@/persistence";
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
  ViewLayout,
  ViewPane,
  ViewPaneType,
} from "@/types";
import { DEFAULT_LEVELS, DEFAULT_PANES, VIEW_PANE_LABELS } from "@/types";

export const Route = createFileRoute("/")({
  component: Home,
});

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
  const [viewPanes, setViewPanes] = useState<ViewPane[]>(DEFAULT_PANES);
  const [viewLayout, setViewLayout] = useState<ViewLayout>("single");
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

  // Persistence: loaded flag
  const [projectLoaded, setProjectLoaded] = useState(false);

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

  // ── Persistence: load on mount ──────────────────────────────
  useEffect(() => {
    loadProject()
      .then((data) => {
        if (data) {
          setBimElements(data.bimElements);
          setMarkups(data.markups);
          setLevels(data.levels);
          setActiveLevel(data.activeLevel);
          showToast("Project restored from auto-save", "info");
        }
      })
      .catch(() => {
        // Silently fail — fresh start
      })
      .finally(() => setProjectLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persistence: auto-save on changes (debounced) ───────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!projectLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProject({
        bimElements,
        markups,
        levels,
        activeLevel,
        savedAt: Date.now(),
      }).catch(() => {});
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [bimElements, markups, levels, activeLevel, projectLoaded]);

  // ── Persistence: export/import/new project ──────────────────
  const handleExportProject = useCallback(() => {
    const data: ProjectData = {
      bimElements,
      markups,
      levels,
      activeLevel,
      savedAt: Date.now(),
    };
    exportProjectJSON(data);
    showToast("Project exported", "success");
  }, [bimElements, markups, levels, activeLevel, showToast]);

  const handleImportProject = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = await importProjectJSON(file);
        setBimElements(data.bimElements);
        setMarkups(data.markups);
        setLevels(data.levels);
        setActiveLevel(data.activeLevel);
        undoStackRef.current = [];
        redoStackRef.current = [];
        showToast("Project imported", "success");
      } catch {
        showToast("Failed to import project", "error");
      }
    };
    input.click();
  }, [showToast]);

  const handleNewProject = useCallback(() => {
    setBimElements([]);
    setMarkups([]);
    setLevels(DEFAULT_LEVELS);
    setActiveLevel("ground");
    setSelectedElement(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    clearProject().catch(() => {});
    showToast("New project created", "info");
  }, [showToast]);

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
  }, []);

  // Select an authored element from the Project Browser tree
  const handleSelectElement = useCallback(
    (elementId: string) => {
      const el = bimElements.find((e) => e.id === elementId);
      if (!el) return;
      // Set as selected element so Properties panel shows it
      setSelectedElement({
        expressID: 0,
        globalId: el.id,
        type: el.type,
        name: el.name,
        properties: el.params as Record<string, string | number | boolean>,
      });
      // Fly to it in the 3D view
      viewer3DRef.current?.flyToElement(el.id);
    },
    [bimElements],
  );

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

  // ── Multi-pane management ────────────────────────────────────
  const handleAddPane = useCallback(
    (type: ViewPaneType) => {
      const newPane: ViewPane = {
        id: crypto.randomUUID(),
        type,
        title: VIEW_PANE_LABELS[type],
      };
      setViewPanes((prev) => {
        const next = [...prev, newPane];
        if (next.length >= 4) setViewLayout("4-up");
        else if (next.length >= 3) setViewLayout("3-up");
        else if (next.length >= 2) setViewLayout("2-up");
        return next;
      });
      showToast(`Opened ${VIEW_PANE_LABELS[type]}`, "info");
    },
    [showToast],
  );

  const handleClosePane = useCallback((id: string) => {
    setViewPanes((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (next.length <= 1) setViewLayout("single");
      else if (next.length === 2) setViewLayout("2-up");
      else if (next.length === 3) setViewLayout("3-up");
      return next;
    });
  }, []);

  const handleChangePaneType = useCallback((id: string, type: ViewPaneType) => {
    setViewPanes((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, type, title: VIEW_PANE_LABELS[type] } : p,
      ),
    );
  }, []);

  const handleSetLayout = useCallback((layout: ViewLayout) => {
    setViewLayout(layout);
    setViewPanes((prev) => {
      const target =
        layout === "single"
          ? 1
          : layout === "2-up"
            ? 2
            : layout === "3-up"
              ? 3
              : 4;
      if (prev.length < target) {
        // Add default panes to fill
        const defaults: ViewPaneType[] = [
          "3d",
          "plan",
          "front-elevation",
          "right-elevation",
        ];
        const panes = [...prev];
        while (panes.length < target) {
          const type = defaults[panes.length] ?? "3d";
          panes.push({
            id: crypto.randomUUID(),
            type,
            title: VIEW_PANE_LABELS[type],
          });
        }
        return panes;
      }
      if (prev.length > target) {
        return prev.slice(0, target);
      }
      return prev;
    });
  }, []);

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

  // Copy element event listener (from RibbonToolbar copy button)
  useEffect(() => {
    const handler = (e: Event) => {
      const el = (e as CustomEvent<BimElement>).detail;
      if (el) handleElementCreated(el);
    };
    window.addEventListener("bim-copy-element", handler);
    return () => window.removeEventListener("bim-copy-element", handler);
  }, [handleElementCreated]);

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

      // Arrow keys to move selected element
      if (selectedElement && !e.shiftKey) {
        const bimEl = bimElements.find(
          (el) => el.id === selectedElement.globalId,
        );
        const step = snapEnabled ? gridSize : 0.5;
        if (
          bimEl &&
          (e.key === "ArrowLeft" ||
            e.key === "ArrowRight" ||
            e.key === "ArrowUp" ||
            e.key === "ArrowDown")
        ) {
          e.preventDefault();
          const dx =
            e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dz =
            e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          handleBimElementUpdate(bimEl.id, {
            start: { x: bimEl.start.x + dx, z: bimEl.start.z + dz },
            end: { x: bimEl.end.x + dx, z: bimEl.end.z + dz },
          });
          return;
        }
      }

      // View layout shortcuts
      if (e.key === "1") {
        handleSetLayout("single");
        return;
      }
      if (e.key === "2") {
        handleSetLayout("2-up");
        return;
      }
      if (e.key === "3") {
        handleSetLayout("3-up");
        return;
      }
      if (e.key === "4") {
        handleSetLayout("4-up");
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
    handleBimElementUpdate,
    handleSetLayout,
    selectedElement,
    bimElements,
    snapEnabled,
    gridSize,
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
        viewLayout={viewLayout}
        onLayoutChange={handleSetLayout}
        onAddPane={handleAddPane}
        viewPanes={viewPanes}
        onUndo={handleUndo}
        onRedo={handleRedo}
        snapEnabled={snapEnabled}
        onSnapToggle={() => setSnapEnabled((prev) => !prev)}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
        levels={levels}
        activeLevel={activeLevel}
        onActiveLevelChange={setActiveLevel}
        onNewProject={handleNewProject}
        onExportProject={handleExportProject}
        onImportProject={handleImportProject}
        selectedElement={selectedElement}
        bimElements={bimElements}
        onBimElementUpdate={handleBimElementUpdate}
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
            onSelectElement={handleSelectElement}
            onMarkupStatusChange={handleMarkupStatusChange}
            onMarkupNavigate={handleMarkupNavigate}
            onMarkupLink={handleMarkupLink}
            levels={levels}
            activeLevel={activeLevel}
            onActiveLevelChange={setActiveLevel}
            onLevelsChange={setLevels}
          />
        </div>

        {/* Center: Multi-pane Viewports */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Viewport tabs showing open panes */}
          <div className="viewport-tabs">
            {viewPanes.map((pane) => (
              <span key={pane.id} className="viewport-tab active">
                {pane.title}
              </span>
            ))}
            <span className="viewport-tab-badge">
              {viewLayout === "single"
                ? "Single"
                : viewLayout === "2-up"
                  ? "2-Up"
                  : viewLayout === "3-up"
                    ? "3-Up"
                    : "4-Up"}
            </span>
          </div>

          {/* Viewport grid */}
          <div
            className={`flex-1 overflow-hidden viewport-grid viewport-grid-${viewLayout}`}
          >
            {viewPanes.map((pane) => {
              const isFirst3D =
                pane.type !== "2d-sheet" &&
                viewPanes.find((p) => p.type !== "2d-sheet")?.id === pane.id;
              return (
                <ViewportPane
                  key={`${pane.id}-${pane.type}`}
                  pane={pane}
                  onClose={handleClosePane}
                  onChangeType={handleChangePaneType}
                  canClose={viewPanes.length > 1}
                  viewer3DRef={isFirst3D ? viewer3DRef : undefined}
                  onModelLoaded={handleModelLoaded}
                  onElementSelected={handleElementSelected}
                  creationTool={creationTool}
                  onElementCreated={handleElementCreated}
                  bimElements={bimElements}
                  snapEnabled={snapEnabled}
                  gridSize={gridSize}
                  pdfCanvasRef={
                    pane.type === "2d-sheet" ? pdfCanvasRef : undefined
                  }
                  onPageChange={handlePageChange}
                  hasPdf={hasPdf}
                  activeTool={activeTool}
                  onMarkupCreated={handleMarkupCreated}
                  currentPage={currentPage}
                  selectedElement={selectedElement}
                />
              );
            })}
          </div>
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
            Shift+Key = Create | G = Snap | 1-4 = Layout
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
