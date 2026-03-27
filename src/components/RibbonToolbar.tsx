import { useState } from "react";
import type { AnnotationTool, CreationTool, GridSize, Level } from "@/types";

/* ------------------------------------------------------------------ */
/*  Revit-style Ribbon Toolbar                                         */
/*  Tabs across the top, each tab reveals grouped tool panels below    */
/* ------------------------------------------------------------------ */

interface RibbonToolbarProps {
  // Creation
  creationTool: CreationTool;
  onCreationToolChange: (tool: CreationTool) => void;
  // Annotation
  annotationTool: AnnotationTool;
  onAnnotationToolChange: (tool: AnnotationTool) => void;
  hasPdf: boolean;
  // View
  viewMode: "split" | "3d" | "2d";
  onViewModeChange: (mode: "split" | "3d" | "2d") => void;
  // Undo/Redo
  onUndo: () => void;
  onRedo: () => void;
  // Snap
  snapEnabled: boolean;
  onSnapToggle: () => void;
  gridSize: GridSize;
  onGridSizeChange: (size: GridSize) => void;
  // Level
  levels: Level[];
  activeLevel: string;
  onActiveLevelChange: (id: string) => void;
}

type RibbonTab = "architecture" | "annotate" | "view" | "modify";

/* ── Tool definitions ─────────────────────────────────────────────── */

interface ToolDef {
  id: string;
  label: string;
  shortcut?: string;
}

interface ToolGroupDef {
  label: string;
  tools: ToolDef[];
}

const ARCHITECTURE_GROUPS: ToolGroupDef[] = [
  {
    label: "Build",
    tools: [
      { id: "wall", label: "Wall", shortcut: "W" },
      { id: "door", label: "Door", shortcut: "D" },
      { id: "window", label: "Window", shortcut: "N" },
      { id: "column", label: "Column", shortcut: "C" },
      { id: "roof", label: "Roof", shortcut: "R" },
      { id: "ceiling", label: "Ceiling", shortcut: "G" },
      { id: "slab", label: "Floor", shortcut: "S" },
      { id: "curtainWall", label: "Curtain Wall", shortcut: "K" },
    ],
  },
  {
    label: "Circulation",
    tools: [
      { id: "stair", label: "Stair", shortcut: "A" },
      { id: "railing", label: "Railing", shortcut: "I" },
    ],
  },
  {
    label: "Structure",
    tools: [{ id: "beam", label: "Beam", shortcut: "B" }],
  },
  {
    label: "Furniture",
    tools: [
      { id: "table", label: "Table", shortcut: "T" },
      { id: "chair", label: "Chair", shortcut: "H" },
      { id: "desk", label: "Desk", shortcut: "E" },
      { id: "shelving", label: "Shelving", shortcut: "L" },
    ],
  },
  {
    label: "Plumbing",
    tools: [
      { id: "toilet", label: "Toilet", shortcut: "O" },
      { id: "sink", label: "Sink", shortcut: "J" },
    ],
  },
  {
    label: "MEP",
    tools: [
      { id: "duct", label: "Duct", shortcut: "U" },
      { id: "pipe", label: "Pipe", shortcut: "P" },
      { id: "lightFixture", label: "Light", shortcut: "F" },
    ],
  },
];

const ANNOTATE_GROUPS: ToolGroupDef[] = [
  {
    label: "Markup",
    tools: [
      { id: "cloud", label: "Cloud" },
      { id: "arrow", label: "Arrow" },
      { id: "callout", label: "Callout" },
      { id: "text", label: "Text" },
    ],
  },
  {
    label: "Shapes",
    tools: [
      { id: "freehand", label: "Freehand" },
      { id: "rectangle", label: "Rectangle" },
      { id: "circle", label: "Circle" },
      { id: "polyline", label: "Polyline" },
      { id: "highlight", label: "Highlight" },
    ],
  },
  {
    label: "Measure",
    tools: [{ id: "measurement", label: "Measure" }],
  },
];

/* ── SVG mini-icons for tools ─────────────────────────────────────── */

function ToolIcon({ id }: { id: string }) {
  // Simple SVG icons that echo Revit's toolbar icons
  const icons: Record<string, React.ReactNode> = {
    wall: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </svg>
    ),
    door: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="5" y="2" width="14" height="20" rx="1" />
        <circle cx="15" cy="13" r="1" fill="currentColor" />
      </svg>
    ),
    window: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="4" y1="12" x2="20" y2="12" />
      </svg>
    ),
    column: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="8" y="2" width="8" height="20" rx="1" />
        <line x1="8" y1="5" x2="16" y2="5" />
        <line x1="8" y1="19" x2="16" y2="19" />
      </svg>
    ),
    roof: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M3 12 L12 4 L21 12" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    ceiling: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="8" width="18" height="3" rx="0.5" />
        <line x1="6" y1="11" x2="6" y2="18" strokeDasharray="2 2" />
        <line x1="18" y1="11" x2="18" y2="18" strokeDasharray="2 2" />
      </svg>
    ),
    slab: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M2 14 L6 10 L22 10 L18 14 Z" />
        <line x1="2" y1="14" x2="18" y2="14" />
      </svg>
    ),
    curtainWall: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="3" width="18" height="18" rx="0.5" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
      </svg>
    ),
    stair: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M4 20 L4 16 L8 16 L8 12 L12 12 L12 8 L16 8 L16 4 L20 4" />
      </svg>
    ),
    railing: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <line x1="3" y1="8" x2="21" y2="8" />
        <line x1="5" y1="8" x2="5" y2="18" />
        <line x1="10" y1="8" x2="10" y2="18" />
        <line x1="15" y1="8" x2="15" y2="18" />
        <line x1="20" y1="8" x2="20" y2="18" />
      </svg>
    ),
    beam: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M2 10 L6 8 L22 8 L18 10 Z" />
        <path d="M2 10 L2 14 L18 14 L22 8" />
      </svg>
    ),
    table: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="8" width="18" height="2" rx="0.5" />
        <line x1="5" y1="10" x2="5" y2="18" />
        <line x1="19" y1="10" x2="19" y2="18" />
      </svg>
    ),
    chair: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M7 12 L7 4 L17 4 L17 12" />
        <rect x="6" y="12" width="12" height="2" rx="0.5" />
        <line x1="7" y1="14" x2="7" y2="20" />
        <line x1="17" y1="14" x2="17" y2="20" />
      </svg>
    ),
    desk: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="2" y="10" width="20" height="2" rx="0.5" />
        <line x1="4" y1="12" x2="4" y2="19" />
        <line x1="20" y1="12" x2="20" y2="19" />
        <rect x="12" y="12" width="7" height="5" rx="0.5" />
      </svg>
    ),
    shelving: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="4" y="3" width="16" height="18" rx="0.5" />
        <line x1="4" y1="9" x2="20" y2="9" />
        <line x1="4" y1="15" x2="20" y2="15" />
      </svg>
    ),
    toilet: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <ellipse cx="12" cy="15" rx="5" ry="4" />
        <rect x="9" y="4" width="6" height="8" rx="1" />
      </svg>
    ),
    sink: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M4 10 Q4 18 12 18 Q20 18 20 10" />
        <line x1="4" y1="10" x2="20" y2="10" />
        <line x1="12" y1="4" x2="12" y2="10" />
      </svg>
    ),
    duct: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="2" y="8" width="20" height="8" rx="1" />
        <line x1="8" y1="8" x2="8" y2="16" strokeDasharray="2 2" />
        <line x1="16" y1="8" x2="16" y2="16" strokeDasharray="2 2" />
      </svg>
    ),
    pipe: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="2" y="10" width="20" height="4" rx="2" />
        <ellipse cx="22" cy="12" rx="1" ry="3" />
      </svg>
    ),
    lightFixture: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
    ),
    // Annotation icons
    cloud: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M6 19 Q2 19 2 15 Q2 12 5 11 Q5 7 9 6 Q13 4 16 7 Q20 6 21 10 Q23 13 20 15 Q22 19 18 19 Z" />
      </svg>
    ),
    arrow: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <line x1="4" y1="20" x2="18" y2="6" />
        <polyline points="10,6 18,6 18,14" />
      </svg>
    ),
    callout: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="3" width="18" height="12" rx="2" />
        <path d="M8 15 L6 21 L12 15" />
      </svg>
    ),
    text: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <line x1="6" y1="5" x2="18" y2="5" />
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="9" y1="19" x2="15" y2="19" />
      </svg>
    ),
    freehand: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M4 17 Q8 8 12 14 Q16 20 20 7" />
      </svg>
    ),
    rectangle: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="5" width="18" height="14" rx="1" />
      </svg>
    ),
    circle: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
    polyline: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <polyline points="3,18 8,8 15,16 21,6" />
        <circle cx="3" cy="18" r="1.5" fill="currentColor" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="15" cy="16" r="1.5" fill="currentColor" />
        <circle cx="21" cy="6" r="1.5" fill="currentColor" />
      </svg>
    ),
    highlight: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect
          x="3"
          y="8"
          width="18"
          height="8"
          rx="1"
          opacity="0.4"
          fill="currentColor"
        />
        <line x1="6" y1="12" x2="18" y2="12" />
      </svg>
    ),
    measurement: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="8" x2="4" y2="16" />
        <line x1="20" y1="8" x2="20" y2="16" />
        <polyline points="6,11 4,12 6,13" fill="currentColor" />
        <polyline points="18,11 20,12 18,13" fill="currentColor" />
      </svg>
    ),
  };

  return (
    <span className="ribbon-tool-icon">
      {icons[id] || (
        <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold font-mono">
          {id.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/* ── Ribbon Tab Panels ────────────────────────────────────────────── */

function RibbonGroup({
  group,
  activeTool,
  onToolSelect,
}: {
  group: ToolGroupDef;
  activeTool: string;
  onToolSelect: (id: string) => void;
}) {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group-tools">
        {group.tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => onToolSelect(tool.id)}
            className={`ribbon-tool-btn ${activeTool === tool.id ? "active" : ""}`}
            title={
              tool.shortcut
                ? `${tool.label} (Shift+${tool.shortcut})`
                : tool.label
            }
          >
            <ToolIcon id={tool.id} />
            <span className="ribbon-tool-label">{tool.label}</span>
          </button>
        ))}
      </div>
      <div className="ribbon-group-label">{group.label}</div>
    </div>
  );
}

export default function RibbonToolbar({
  creationTool,
  onCreationToolChange,
  annotationTool,
  onAnnotationToolChange,
  hasPdf,
  viewMode,
  onViewModeChange,
  onUndo,
  onRedo,
  snapEnabled,
  onSnapToggle,
  gridSize,
  onGridSizeChange,
  levels,
  activeLevel,
  onActiveLevelChange,
}: RibbonToolbarProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>("architecture");

  const handleCreationTool = (id: string) => {
    onCreationToolChange(id as CreationTool);
    if (activeTab === "annotate") {
      onAnnotationToolChange("select");
    }
  };

  const handleAnnotationTool = (id: string) => {
    onAnnotationToolChange(id as AnnotationTool);
    onCreationToolChange("none");
  };

  return (
    <div className="ribbon-container">
      {/* ── Quick Access Bar (above tabs) ─────────────────────── */}
      <div className="ribbon-quick-access">
        <span className="ribbon-app-title">BIM Trace</span>
        <div className="ribbon-qa-divider" />
        <button
          type="button"
          onClick={onUndo}
          className="ribbon-qa-btn"
          title="Undo (Ctrl+Z)"
        >
          <svg
            viewBox="0 0 20 20"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M4 8 L8 4 M4 8 L8 12 M4 8 L14 8 Q17 8 17 12 Q17 16 14 16 L10 16" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRedo}
          className="ribbon-qa-btn"
          title="Redo (Ctrl+Y)"
        >
          <svg
            viewBox="0 0 20 20"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M16 8 L12 4 M16 8 L12 12 M16 8 L6 8 Q3 8 3 12 Q3 16 6 16 L10 16" />
          </svg>
        </button>
      </div>

      {/* ── Tab strip ─────────────────────────────────────────── */}
      <div className="ribbon-tabs">
        {(
          [
            { id: "modify", label: "Modify" },
            { id: "architecture", label: "Architecture" },
            { id: "annotate", label: "Annotate" },
            { id: "view", label: "View" },
          ] as { id: RibbonTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`ribbon-tab ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab panel ─────────────────────────────────────────── */}
      <div className="ribbon-panel">
        {activeTab === "modify" && (
          <div className="ribbon-panel-content">
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={() => {
                    onCreationToolChange("none");
                    onAnnotationToolChange("select");
                  }}
                  className={`ribbon-tool-btn ${creationTool === "none" ? "active" : ""}`}
                  title="Select (V / Escape)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M4 4 L4 18 L10 13 L16 19" />
                    <path
                      d="M4 4 L15 8 L10 13"
                      fill="currentColor"
                      opacity="0.3"
                    />
                  </svg>
                  <span className="ribbon-tool-label">Select</span>
                </button>
              </div>
              <div className="ribbon-group-label">Selection</div>
            </div>

            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={onUndo}
                  className="ribbon-tool-btn"
                  title="Undo (Ctrl+Z)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M4 10 L9 5 M4 10 L9 15 M4 10 L16 10 Q20 10 20 14 Q20 18 16 18 L12 18" />
                  </svg>
                  <span className="ribbon-tool-label">Undo</span>
                </button>
                <button
                  type="button"
                  onClick={onRedo}
                  className="ribbon-tool-btn"
                  title="Redo (Ctrl+Y)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M20 10 L15 5 M20 10 L15 15 M20 10 L8 10 Q4 10 4 14 Q4 18 8 18 L12 18" />
                  </svg>
                  <span className="ribbon-tool-label">Redo</span>
                </button>
              </div>
              <div className="ribbon-group-label">Clipboard</div>
            </div>
          </div>
        )}

        {activeTab === "architecture" && (
          <div className="ribbon-panel-content">
            {ARCHITECTURE_GROUPS.map((group) => (
              <RibbonGroup
                key={group.label}
                group={group}
                activeTool={creationTool}
                onToolSelect={handleCreationTool}
              />
            ))}
          </div>
        )}

        {activeTab === "annotate" && (
          <div className="ribbon-panel-content">
            {!hasPdf ? (
              <div className="flex items-center px-4 text-xs text-slate-500">
                Load a PDF to enable annotation tools
              </div>
            ) : (
              <>
                <div className="ribbon-group">
                  <div className="ribbon-group-tools">
                    <button
                      type="button"
                      onClick={() => handleAnnotationTool("select")}
                      className={`ribbon-tool-btn ${annotationTool === "select" ? "active" : ""}`}
                      title="Select"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path d="M4 4 L4 18 L10 13 L16 19" />
                        <path
                          d="M4 4 L15 8 L10 13"
                          fill="currentColor"
                          opacity="0.3"
                        />
                      </svg>
                      <span className="ribbon-tool-label">Select</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Selection</div>
                </div>
                {ANNOTATE_GROUPS.map((group) => (
                  <RibbonGroup
                    key={group.label}
                    group={group}
                    activeTool={annotationTool}
                    onToolSelect={handleAnnotationTool}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === "view" && (
          <div className="ribbon-panel-content">
            {/* View mode group */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                {(["split", "3d", "2d"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onViewModeChange(mode)}
                    className={`ribbon-tool-btn ${viewMode === mode ? "active" : ""}`}
                    title={`${mode === "split" ? "Split View" : mode.toUpperCase() + " View"} (${mode === "split" ? "1" : mode === "3d" ? "2" : "3"})`}
                  >
                    {mode === "split" ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="12" y1="3" x2="12" y2="21" />
                      </svg>
                    ) : mode === "3d" ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z" />
                        <path d="M12 2 L12 22" />
                        <path d="M2 8 L22 8" opacity="0.4" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="3" y1="8" x2="21" y2="8" />
                        <line x1="7" y1="3" x2="7" y2="21" />
                      </svg>
                    )}
                    <span className="ribbon-tool-label">
                      {mode === "split" ? "Split" : mode.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
              <div className="ribbon-group-label">Windows</div>
            </div>

            {/* Snap group */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={onSnapToggle}
                  className={`ribbon-tool-btn ${snapEnabled ? "active snap-active" : ""}`}
                  title="Snap to Grid (G)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="3" y="3" width="18" height="18" rx="1" />
                    <line x1="9" y1="3" x2="9" y2="21" strokeDasharray="2 2" />
                    <line
                      x1="15"
                      y1="3"
                      x2="15"
                      y2="21"
                      strokeDasharray="2 2"
                    />
                    <line x1="3" y1="9" x2="21" y2="9" strokeDasharray="2 2" />
                    <line
                      x1="3"
                      y1="15"
                      x2="21"
                      y2="15"
                      strokeDasharray="2 2"
                    />
                  </svg>
                  <span className="ribbon-tool-label">Snap</span>
                </button>
                {snapEnabled && (
                  <div className="flex flex-col items-center gap-0.5 px-1">
                    <select
                      value={gridSize}
                      onChange={(e) =>
                        onGridSizeChange(
                          Number.parseFloat(e.target.value) as GridSize,
                        )
                      }
                      className="ribbon-select"
                    >
                      <option value={0.25}>0.25m</option>
                      <option value={0.5}>0.5m</option>
                      <option value={1}>1m</option>
                    </select>
                    <span className="text-[8px] text-slate-500">Grid</span>
                  </div>
                )}
              </div>
              <div className="ribbon-group-label">Snapping</div>
            </div>

            {/* Level group */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <div className="flex flex-col items-center gap-1 px-2">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                    <line x1="6" y1="4" x2="6" y2="8" />
                    <line x1="6" y1="10" x2="6" y2="14" />
                    <line x1="6" y1="16" x2="6" y2="20" />
                  </svg>
                  <select
                    value={activeLevel}
                    onChange={(e) => onActiveLevelChange(e.target.value)}
                    className="ribbon-select"
                  >
                    {levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name} ({level.height}m)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="ribbon-group-label">Level</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
