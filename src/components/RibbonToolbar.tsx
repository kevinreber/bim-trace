import { useState } from "react";
import type {
  AnnotationTool,
  BimConstraint,
  BimElement,
  BimElementType,
  CategoryVisibility,
  CreationTool,
  DesignOption,
  DetailLevel,
  ElementGroup,
  GridSize,
  Level,
  SavedView,
  ScheduleType,
  SectionBox,
  SelectedElement,
  UnitSystem,
  ViewFilterColorBy,
  ViewLayout,
  ViewPane,
  ViewPaneType,
  ViewTemplate,
  Workset,
} from "@/types";
import { formatUnit } from "@/types";
import { detectClashes } from "./geometryBuilders";

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
  viewLayout: ViewLayout;
  onLayoutChange: (layout: ViewLayout) => void;
  onAddPane: (type: ViewPaneType) => void;
  viewPanes: ViewPane[];
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
  // Project persistence
  onNewProject: () => void;
  onExportProject: () => void;
  onImportProject: () => void;
  // Manipulation
  selectedElement: SelectedElement | null;
  bimElements: BimElement[];
  onBimElementUpdate: (id: string, updates: Partial<BimElement>) => void;
  // AI
  onAiGenerate: () => void;
  // Visibility / Graphics
  categoryVisibility: Record<string, CategoryVisibility>;
  onCategoryVisibilityChange: (
    type: string,
    vis: Partial<CategoryVisibility>,
  ) => void;
  // Saved views
  savedViews: SavedView[];
  onSaveView: () => void;
  onLoadView: (view: SavedView) => void;
  onDeleteView: (id: string) => void;
  // Grouping
  groups: ElementGroup[];
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  selectedElementIds: string[];
  // Schedule
  onOpenSchedule: (type: ScheduleType) => void;
  // Navigation
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomToFit?: () => void;
  // Section box
  sectionBox?: SectionBox;
  onSectionBoxChange?: (box: SectionBox) => void;
  // View filter
  viewFilterColorBy?: ViewFilterColorBy;
  onViewFilterChange?: (filter: ViewFilterColorBy) => void;
  // Detail level & templates
  detailLevel?: DetailLevel;
  onDetailLevelChange?: (level: DetailLevel) => void;
  // Sun study
  sunHour?: number | null;
  onSunHourChange?: (hour: number | null) => void;
  viewTemplates?: ViewTemplate[];
  onSaveViewTemplate?: () => void;
  onLoadViewTemplate?: (template: ViewTemplate) => void;
  onDeleteViewTemplate?: (id: string) => void;
  // Sheet composition
  onOpenSheetComposer?: () => void;
  // Keynote legend
  onOpenKeynoteLegend?: () => void;
  // Design options
  designOptions?: DesignOption[];
  onDesignOptionChange?: (options: DesignOption[]) => void;
  // Constraints
  constraints?: BimConstraint[];
  onConstraintsChange?: (constraints: BimConstraint[]) => void;
  // Worksets
  worksets?: Workset[];
  onWorksetsChange?: (worksets: Workset[]) => void;
  // Topography
  onGenerateTerrain?: () => void;
  unitSystem: UnitSystem;
}

type RibbonTab = "architecture" | "annotate" | "view" | "modify" | "manage";

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
  {
    label: "Room & Area",
    tools: [{ id: "room", label: "Room", shortcut: "M" }],
  },
  {
    label: "Reference",
    tools: [{ id: "gridline", label: "Gridline" }],
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
  {
    label: "3D Measure",
    tools: [
      { id: "dimension3d", label: "3D Dim" },
      { id: "spotElevation", label: "Spot EL" },
    ],
  },
  {
    label: "Detail",
    tools: [
      { id: "keynote", label: "Keynote" },
      { id: "detailLine", label: "Det. Line" },
      { id: "filledRegion", label: "Fill Rgn" },
    ],
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
    gridline: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <line
          x1="12"
          y1="2"
          x2="12"
          y2="22"
          strokeDasharray="3 2"
          stroke="#06b6d4"
        />
        <circle cx="12" cy="4" r="2.5" stroke="#06b6d4" />
        <text
          x="12"
          y="5.5"
          textAnchor="middle"
          fontSize="4"
          fill="#06b6d4"
          stroke="none"
        >
          A
        </text>
      </svg>
    ),
    room: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect
          x="3"
          y="6"
          width="18"
          height="14"
          rx="1"
          fill="currentColor"
          opacity="0.1"
        />
        <rect x="3" y="6" width="18" height="14" rx="1" />
        <text
          x="12"
          y="15"
          textAnchor="middle"
          fontSize="6"
          fill="currentColor"
          stroke="none"
        >
          RM
        </text>
      </svg>
    ),
    dimension3d: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <line x1="4" y1="16" x2="20" y2="16" stroke="#fbbf24" />
        <line x1="4" y1="12" x2="4" y2="20" stroke="#fbbf24" />
        <line x1="20" y1="12" x2="20" y2="20" stroke="#fbbf24" />
        <polyline points="6,15 4,16 6,17" fill="#fbbf24" stroke="#fbbf24" />
        <polyline points="18,15 20,16 18,17" fill="#fbbf24" stroke="#fbbf24" />
        <text
          x="12"
          y="12"
          textAnchor="middle"
          fontSize="7"
          fill="#fbbf24"
          stroke="none"
        >
          3D
        </text>
      </svg>
    ),
    spotElevation: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <line x1="12" y1="4" x2="12" y2="16" stroke="#ff6b6b" />
        <line x1="8" y1="20" x2="16" y2="12" stroke="#ff6b6b" />
        <line x1="8" y1="12" x2="16" y2="20" stroke="#ff6b6b" />
        <text
          x="12"
          y="8"
          textAnchor="middle"
          fontSize="6"
          fill="#ff6b6b"
          stroke="none"
        >
          EL
        </text>
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
    keynote: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <circle cx="8" cy="8" r="5" />
        <text
          x="8"
          y="10"
          textAnchor="middle"
          fontSize="6"
          fill="currentColor"
          stroke="none"
        >
          K
        </text>
        <line x1="12" y1="12" x2="20" y2="20" />
      </svg>
    ),
    detailLine: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <line x1="4" y1="20" x2="20" y2="4" strokeDasharray="4 2" />
        <circle cx="4" cy="20" r="2" />
        <circle cx="20" cy="4" r="2" />
      </svg>
    ),
    filledRegion: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <line x1="4" y1="8" x2="8" y2="4" />
        <line x1="4" y1="12" x2="12" y2="4" />
        <line x1="4" y1="16" x2="16" y2="4" />
        <line x1="4" y1="20" x2="20" y2="4" />
        <line x1="8" y1="20" x2="20" y2="8" />
        <line x1="12" y1="20" x2="20" y2="12" />
        <line x1="16" y1="20" x2="20" y2="16" />
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

/* ── Revit-style Tooltip ──────────────────────────────────────────── */

function RibbonTooltip({
  tool,
  children,
}: {
  tool: ToolDef;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  return (
    <div
      className="relative"
      onMouseEnter={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 4 });
        setShow(true);
      }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className="ribbon-tooltip"
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            transform: "translateX(-50%)",
            zIndex: 9999,
          }}
        >
          <div className="ribbon-tooltip-title">{tool.label}</div>
          {tool.shortcut && (
            <div className="ribbon-tooltip-shortcut">
              Shortcut: Shift+{tool.shortcut}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
          <RibbonTooltip key={tool.id} tool={tool}>
            <button
              type="button"
              onClick={() => onToolSelect(tool.id)}
              className={`ribbon-tool-btn ${activeTool === tool.id ? "active" : ""}`}
            >
              <ToolIcon id={tool.id} />
              <span className="ribbon-tool-label">{tool.label}</span>
            </button>
          </RibbonTooltip>
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
  viewLayout,
  onLayoutChange,
  onAddPane,
  viewPanes,
  onUndo,
  onRedo,
  snapEnabled,
  onSnapToggle,
  gridSize,
  onGridSizeChange,
  levels,
  activeLevel,
  onActiveLevelChange,
  onNewProject,
  onExportProject,
  onImportProject,
  selectedElement,
  bimElements,
  onBimElementUpdate,
  onAiGenerate,
  categoryVisibility,
  onCategoryVisibilityChange,
  savedViews,
  onSaveView,
  onLoadView,
  onDeleteView,
  groups,
  onGroupSelected,
  onUngroupSelected,
  selectedElementIds,
  onOpenSchedule,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  sectionBox,
  onSectionBoxChange,
  viewFilterColorBy = "none",
  onViewFilterChange,
  detailLevel = "medium",
  onDetailLevelChange,
  sunHour = null,
  onSunHourChange,
  onOpenSheetComposer,
  onOpenKeynoteLegend,
  designOptions = [],
  onDesignOptionChange,
  constraints = [],
  onConstraintsChange,
  worksets = [],
  onWorksetsChange,
  onGenerateTerrain,
  viewTemplates = [],
  onSaveViewTemplate,
  onLoadViewTemplate,
  onDeleteViewTemplate,
  unitSystem,
}: RibbonToolbarProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>("architecture");
  const [moveDistance, setMoveDistance] = useState("1.0");
  const [rotateAngle, setRotateAngle] = useState("45");

  // ── Manipulation helpers ──────────────────────────────────────
  const selectedBimElement = selectedElement
    ? bimElements.find((el) => el.id === selectedElement.globalId)
    : null;

  const handleMove = (axis: "x" | "z", delta: number) => {
    if (!selectedBimElement || selectedBimElement.pinned) return;
    onBimElementUpdate(selectedBimElement.id, {
      start: {
        x: selectedBimElement.start.x + (axis === "x" ? delta : 0),
        z: selectedBimElement.start.z + (axis === "z" ? delta : 0),
      },
      end: {
        x: selectedBimElement.end.x + (axis === "x" ? delta : 0),
        z: selectedBimElement.end.z + (axis === "z" ? delta : 0),
      },
    });
  };

  const handleRotate = (angleDeg: number) => {
    if (!selectedBimElement || selectedBimElement.pinned) return;
    const angleRad = (angleDeg * Math.PI) / 180;
    const currentRot = selectedBimElement.rotation ?? 0;
    onBimElementUpdate(selectedBimElement.id, {
      rotation: currentRot + angleRad,
    });
  };

  const handleTogglePin = () => {
    if (!selectedBimElement) return;
    onBimElementUpdate(selectedBimElement.id, {
      pinned: !selectedBimElement.pinned,
    });
  };

  const handleCopy = () => {
    if (!selectedBimElement) return;
    const offset = 1; // 1m offset
    const newEl: BimElement = {
      ...selectedBimElement,
      id: crypto.randomUUID(),
      name: `${selectedBimElement.name} (copy)`,
      start: {
        x: selectedBimElement.start.x + offset,
        z: selectedBimElement.start.z + offset,
      },
      end: {
        x: selectedBimElement.end.x + offset,
        z: selectedBimElement.end.z + offset,
      },
      params: { ...selectedBimElement.params },
    };
    // We use onBimElementUpdate with a trick: add via the parent's element creation
    // Instead, we dispatch a custom event that the parent listens for
    window.dispatchEvent(
      new CustomEvent("bim-copy-element", { detail: newEl }),
    );
  };

  const [arrayCount, setArrayCount] = useState("3");
  const [arraySpacing, setArraySpacing] = useState("2.0");

  const handleLinearArray = (axis: "x" | "z") => {
    if (!selectedBimElement) return;
    const count = Math.max(
      2,
      Math.min(50, Math.round(Number.parseFloat(arrayCount) || 3)),
    );
    const spacing = Number.parseFloat(arraySpacing) || 2.0;
    for (let i = 1; i < count; i++) {
      const dx = axis === "x" ? spacing * i : 0;
      const dz = axis === "z" ? spacing * i : 0;
      const newEl: BimElement = {
        ...selectedBimElement,
        id: crypto.randomUUID(),
        name: `${selectedBimElement.name} (${i + 1})`,
        start: {
          x: selectedBimElement.start.x + dx,
          z: selectedBimElement.start.z + dz,
        },
        end: {
          x: selectedBimElement.end.x + dx,
          z: selectedBimElement.end.z + dz,
        },
        params: { ...selectedBimElement.params },
      };
      window.dispatchEvent(
        new CustomEvent("bim-copy-element", { detail: newEl }),
      );
    }
  };

  const handleRadialArray = () => {
    if (!selectedBimElement) return;
    const count = Math.max(
      2,
      Math.min(50, Math.round(Number.parseFloat(arrayCount) || 3)),
    );
    const cx = (selectedBimElement.start.x + selectedBimElement.end.x) / 2;
    const cz = (selectedBimElement.start.z + selectedBimElement.end.z) / 2;
    const angleStep = (2 * Math.PI) / count;
    for (let i = 1; i < count; i++) {
      const angle = angleStep * i;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotatePoint = (px: number, pz: number) => ({
        x: cx + (px - cx) * cos - (pz - cz) * sin,
        z: cz + (px - cx) * sin + (pz - cz) * cos,
      });
      const newStart = rotatePoint(
        selectedBimElement.start.x,
        selectedBimElement.start.z,
      );
      const newEnd = rotatePoint(
        selectedBimElement.end.x,
        selectedBimElement.end.z,
      );
      const newEl: BimElement = {
        ...selectedBimElement,
        id: crypto.randomUUID(),
        name: `${selectedBimElement.name} (${i + 1})`,
        start: newStart,
        end: newEnd,
        rotation: (selectedBimElement.rotation ?? 0) + angle,
        params: { ...selectedBimElement.params },
      };
      window.dispatchEvent(
        new CustomEvent("bim-copy-element", { detail: newEl }),
      );
    }
  };

  const selectedElements = selectedElementIds
    .map((id) => bimElements.find((el) => el.id === id))
    .filter(Boolean) as BimElement[];

  const handleAlignLeft = () => {
    if (selectedElements.length < 2) return;
    const minX = Math.min(
      ...selectedElements.map((el) => Math.min(el.start.x, el.end.x)),
    );
    for (const el of selectedElements) {
      if (el.pinned) continue;
      const dx = minX - Math.min(el.start.x, el.end.x);
      onBimElementUpdate(el.id, {
        start: { x: el.start.x + dx, z: el.start.z },
        end: { x: el.end.x + dx, z: el.end.z },
      });
    }
  };

  const handleAlignRight = () => {
    if (selectedElements.length < 2) return;
    const maxX = Math.max(
      ...selectedElements.map((el) => Math.max(el.start.x, el.end.x)),
    );
    for (const el of selectedElements) {
      if (el.pinned) continue;
      const dx = maxX - Math.max(el.start.x, el.end.x);
      onBimElementUpdate(el.id, {
        start: { x: el.start.x + dx, z: el.start.z },
        end: { x: el.end.x + dx, z: el.end.z },
      });
    }
  };

  const handleAlignTop = () => {
    if (selectedElements.length < 2) return;
    const minZ = Math.min(
      ...selectedElements.map((el) => Math.min(el.start.z, el.end.z)),
    );
    for (const el of selectedElements) {
      if (el.pinned) continue;
      const dz = minZ - Math.min(el.start.z, el.end.z);
      onBimElementUpdate(el.id, {
        start: { x: el.start.x, z: el.start.z + dz },
        end: { x: el.end.x, z: el.end.z + dz },
      });
    }
  };

  const handleDistributeX = () => {
    if (selectedElements.length < 3) return;
    const sorted = [...selectedElements].sort(
      (a, b) => (a.start.x + a.end.x) / 2 - (b.start.x + b.end.x) / 2,
    );
    const first = (sorted[0].start.x + sorted[0].end.x) / 2;
    const last =
      (sorted[sorted.length - 1].start.x + sorted[sorted.length - 1].end.x) / 2;
    const step = (last - first) / (sorted.length - 1);
    for (let i = 1; i < sorted.length - 1; i++) {
      const el = sorted[i];
      if (el.pinned) continue;
      const cx = (el.start.x + el.end.x) / 2;
      const target = first + step * i;
      const dx = target - cx;
      onBimElementUpdate(el.id, {
        start: { x: el.start.x + dx, z: el.start.z },
        end: { x: el.end.x + dx, z: el.end.z },
      });
    }
  };

  const handleDistributeZ = () => {
    if (selectedElements.length < 3) return;
    const sorted = [...selectedElements].sort(
      (a, b) => (a.start.z + a.end.z) / 2 - (b.start.z + b.end.z) / 2,
    );
    const first = (sorted[0].start.z + sorted[0].end.z) / 2;
    const last =
      (sorted[sorted.length - 1].start.z + sorted[sorted.length - 1].end.z) / 2;
    const step = (last - first) / (sorted.length - 1);
    for (let i = 1; i < sorted.length - 1; i++) {
      const el = sorted[i];
      if (el.pinned) continue;
      const cz = (el.start.z + el.end.z) / 2;
      const target = first + step * i;
      const dz = target - cz;
      onBimElementUpdate(el.id, {
        start: { x: el.start.x, z: el.start.z + dz },
        end: { x: el.end.x, z: el.end.z + dz },
      });
    }
  };

  const handleSplitWall = () => {
    if (!selectedBimElement || selectedBimElement.type !== "wall") return;
    if (selectedBimElement.pinned) return;
    // Split at midpoint
    const midX = (selectedBimElement.start.x + selectedBimElement.end.x) / 2;
    const midZ = (selectedBimElement.start.z + selectedBimElement.end.z) / 2;
    // Update original wall to end at midpoint
    onBimElementUpdate(selectedBimElement.id, {
      end: { x: midX, z: midZ },
    });
    // Create second wall from midpoint to original end
    const newWall: BimElement = {
      ...selectedBimElement,
      id: crypto.randomUUID(),
      name: `${selectedBimElement.name} (split)`,
      start: { x: midX, z: midZ },
      end: { ...selectedBimElement.end },
      params: { ...selectedBimElement.params },
    };
    window.dispatchEvent(
      new CustomEvent("bim-copy-element", { detail: newWall }),
    );
  };

  const handleExtendWall = () => {
    if (!selectedBimElement || selectedBimElement.type !== "wall") return;
    if (selectedBimElement.pinned) return;
    const extDist = Number.parseFloat(moveDistance) || 1.0;
    const dx = selectedBimElement.end.x - selectedBimElement.start.x;
    const dz = selectedBimElement.end.z - selectedBimElement.start.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) return;
    const dirX = dx / len;
    const dirZ = dz / len;
    onBimElementUpdate(selectedBimElement.id, {
      end: {
        x: selectedBimElement.end.x + dirX * extDist,
        z: selectedBimElement.end.z + dirZ * extDist,
      },
    });
  };

  const handleTrimWall = () => {
    if (!selectedBimElement || selectedBimElement.type !== "wall") return;
    if (selectedBimElement.pinned) return;
    const trimDist = Number.parseFloat(moveDistance) || 1.0;
    const dx = selectedBimElement.end.x - selectedBimElement.start.x;
    const dz = selectedBimElement.end.z - selectedBimElement.start.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len <= trimDist) return; // Can't trim shorter than trim distance
    const dirX = dx / len;
    const dirZ = dz / len;
    onBimElementUpdate(selectedBimElement.id, {
      end: {
        x: selectedBimElement.end.x - dirX * trimDist,
        z: selectedBimElement.end.z - dirZ * trimDist,
      },
    });
  };

  const handleOffset = () => {
    if (!selectedBimElement || selectedBimElement.pinned) return;
    const dist = Number.parseFloat(moveDistance) || 1.0;
    // Compute perpendicular offset direction
    const dx = selectedBimElement.end.x - selectedBimElement.start.x;
    const dz = selectedBimElement.end.z - selectedBimElement.start.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) return;
    // Normal direction (perpendicular)
    const nx = -dz / len;
    const nz = dx / len;
    const newEl: BimElement = {
      ...selectedBimElement,
      id: crypto.randomUUID(),
      name: `${selectedBimElement.name} (offset)`,
      start: {
        x: selectedBimElement.start.x + nx * dist,
        z: selectedBimElement.start.z + nz * dist,
      },
      end: {
        x: selectedBimElement.end.x + nx * dist,
        z: selectedBimElement.end.z + nz * dist,
      },
      params: { ...selectedBimElement.params },
    };
    window.dispatchEvent(
      new CustomEvent("bim-copy-element", { detail: newEl }),
    );
  };

  const handleMirror = () => {
    if (!selectedBimElement) return;
    // Mirror across the X axis (flip Z coordinates)
    const cx = (selectedBimElement.start.x + selectedBimElement.end.x) / 2;
    onBimElementUpdate(selectedBimElement.id, {
      start: {
        x: 2 * cx - selectedBimElement.start.x,
        z: selectedBimElement.start.z,
      },
      end: {
        x: 2 * cx - selectedBimElement.end.x,
        z: selectedBimElement.end.z,
      },
    });
  };

  const handleCreationTool = (id: string) => {
    onCreationToolChange(id as CreationTool);
    if (activeTab === "annotate") {
      onAnnotationToolChange("select");
    }
  };

  const handleAnnotationTool = (id: string) => {
    // dimension3d and spotElevation use the creation tool system, not annotation
    if (id === "dimension3d" || id === "spotElevation") {
      onCreationToolChange(id as "dimension3d" | "spotElevation");
      onAnnotationToolChange("select");
      return;
    }
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
          onClick={onNewProject}
          className="ribbon-qa-btn"
          title="New Project"
        >
          <svg
            viewBox="0 0 20 20"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="3" y="3" width="14" height="14" rx="1" />
            <line x1="10" y1="7" x2="10" y2="13" />
            <line x1="7" y1="10" x2="13" y2="10" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onImportProject}
          className="ribbon-qa-btn"
          title="Open Project (JSON)"
        >
          <svg
            viewBox="0 0 20 20"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 10 L3 15 Q3 17 5 17 L15 17 Q17 17 17 15 L17 10" />
            <path d="M10 3 L10 12" />
            <path d="M7 9 L10 12 L13 9" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onExportProject}
          className="ribbon-qa-btn"
          title="Save Project (JSON)"
        >
          <svg
            viewBox="0 0 20 20"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 10 L3 15 Q3 17 5 17 L15 17 Q17 17 17 15 L17 10" />
            <path d="M10 12 L10 3" />
            <path d="M7 6 L10 3 L13 6" />
          </svg>
        </button>
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
            { id: "manage", label: "Manage" },
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

            {/* Move tools */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={() =>
                    handleMove("x", -(Number.parseFloat(moveDistance) || 0.5))
                  }
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title="Move Left (-X)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="9,8 5,12 9,16" />
                  </svg>
                  <span className="ribbon-tool-label">-X</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleMove("x", Number.parseFloat(moveDistance) || 0.5)
                  }
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title="Move Right (+X)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="15,8 19,12 15,16" />
                  </svg>
                  <span className="ribbon-tool-label">+X</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleMove("z", -(Number.parseFloat(moveDistance) || 0.5))
                  }
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title="Move Forward (-Z)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="8,9 12,5 16,9" />
                  </svg>
                  <span className="ribbon-tool-label">-Z</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleMove("z", Number.parseFloat(moveDistance) || 0.5)
                  }
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title="Move Back (+Z)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="8,15 12,19 16,15" />
                  </svg>
                  <span className="ribbon-tool-label">+Z</span>
                </button>
                <input
                  type="number"
                  value={moveDistance}
                  onChange={(e) => setMoveDistance(e.target.value)}
                  className="ribbon-numeric-input"
                  title="Move distance (meters)"
                  step="0.1"
                  min="0.01"
                  style={{
                    width: "48px",
                    height: "24px",
                    fontSize: "10px",
                    textAlign: "center",
                    border: "1px solid var(--revit-border)",
                    borderRadius: "2px",
                    background: "var(--revit-input-bg, #2a2a2a)",
                    color: "var(--revit-text)",
                    padding: "0 2px",
                  }}
                />
              </div>
              <div className="ribbon-group-label">Move</div>
            </div>

            {/* Rotate & Transform */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={() =>
                    handleRotate(-(Number.parseFloat(rotateAngle) || 45))
                  }
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title={`Rotate -${rotateAngle}°`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M4 12 A8 8 0 0 1 20 12" />
                    <polyline points="4,8 4,12 8,12" />
                  </svg>
                  <span className="ribbon-tool-label">CCW</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleRotate(Number.parseFloat(rotateAngle) || 45)
                  }
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title={`Rotate +${rotateAngle}°`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M20 12 A8 8 0 0 0 4 12" />
                    <polyline points="20,8 20,12 16,12" />
                  </svg>
                  <span className="ribbon-tool-label">CW</span>
                </button>
                <input
                  type="number"
                  value={rotateAngle}
                  onChange={(e) => setRotateAngle(e.target.value)}
                  className="ribbon-numeric-input"
                  title="Rotation angle (degrees)"
                  step="15"
                  min="1"
                  max="360"
                  style={{
                    width: "40px",
                    height: "24px",
                    fontSize: "10px",
                    textAlign: "center",
                    border: "1px solid var(--revit-border)",
                    borderRadius: "2px",
                    background: "var(--revit-input-bg, #2a2a2a)",
                    color: "var(--revit-text)",
                    padding: "0 2px",
                  }}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title="Copy Element"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="8" y="8" width="12" height="12" rx="1" />
                    <path d="M4 16 L4 5 Q4 4 5 4 L16 4" />
                  </svg>
                  <span className="ribbon-tool-label">Copy</span>
                </button>
                <button
                  type="button"
                  onClick={handleMirror}
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title="Mirror Element"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line
                      x1="12"
                      y1="3"
                      x2="12"
                      y2="21"
                      strokeDasharray="3 2"
                    />
                    <path d="M8 8 L4 12 L8 16" />
                    <path d="M16 8 L20 12 L16 16" />
                  </svg>
                  <span className="ribbon-tool-label">Mirror</span>
                </button>
                <button
                  type="button"
                  onClick={handleOffset}
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title={`Offset: parallel copy at ${moveDistance}m distance`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="4" y1="4" x2="4" y2="20" />
                    <line
                      x1="14"
                      y1="4"
                      x2="14"
                      y2="20"
                      strokeDasharray="3 2"
                    />
                    <path d="M7 12 L11 12" />
                    <polyline points="10,10 12,12 10,14" />
                  </svg>
                  <span className="ribbon-tool-label">Offset</span>
                </button>
              </div>
              <div className="ribbon-group-label">Transform</div>
            </div>

            {/* Array tools */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={() => handleLinearArray("x")}
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title="Linear Array along X"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="2" y="8" width="5" height="8" rx="0.5" />
                    <rect x="9.5" y="8" width="5" height="8" rx="0.5" />
                    <rect x="17" y="8" width="5" height="8" rx="0.5" />
                  </svg>
                  <span className="ribbon-tool-label">X Arr</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLinearArray("z")}
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title="Linear Array along Z"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="8" y="2" width="8" height="5" rx="0.5" />
                    <rect x="8" y="9.5" width="8" height="5" rx="0.5" />
                    <rect x="8" y="17" width="8" height="5" rx="0.5" />
                  </svg>
                  <span className="ribbon-tool-label">Z Arr</span>
                </button>
                <button
                  type="button"
                  onClick={handleRadialArray}
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement}
                  title="Radial Array"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <circle cx="12" cy="12" r="8" strokeDasharray="3 2" />
                    <rect x="10" y="2" width="4" height="4" rx="0.5" />
                    <rect x="18" y="10" width="4" height="4" rx="0.5" />
                    <rect x="2" y="10" width="4" height="4" rx="0.5" />
                  </svg>
                  <span className="ribbon-tool-label">Radial</span>
                </button>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    fontSize: "9px",
                    color: "var(--revit-text-dim, #999)",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    N
                    <input
                      type="number"
                      value={arrayCount}
                      onChange={(e) => setArrayCount(e.target.value)}
                      title="Number of copies"
                      step="1"
                      min="2"
                      max="50"
                      style={{
                        width: "32px",
                        height: "18px",
                        fontSize: "9px",
                        textAlign: "center",
                        border: "1px solid var(--revit-border)",
                        borderRadius: "2px",
                        background: "var(--revit-input-bg, #2a2a2a)",
                        color: "var(--revit-text)",
                        padding: "0 1px",
                      }}
                    />
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    D
                    <input
                      type="number"
                      value={arraySpacing}
                      onChange={(e) => setArraySpacing(e.target.value)}
                      title="Spacing (meters)"
                      step="0.5"
                      min="0.1"
                      style={{
                        width: "32px",
                        height: "18px",
                        fontSize: "9px",
                        textAlign: "center",
                        border: "1px solid var(--revit-border)",
                        borderRadius: "2px",
                        background: "var(--revit-input-bg, #2a2a2a)",
                        color: "var(--revit-text)",
                        padding: "0 1px",
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="ribbon-group-label">Array</div>
            </div>

            {/* Wall editing: Split/Extend/Trim */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={handleSplitWall}
                  className="ribbon-tool-btn"
                  disabled={
                    !selectedBimElement || selectedBimElement.type !== "wall"
                  }
                  title="Split Wall at midpoint"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="4" y1="12" x2="10" y2="12" />
                    <line x1="14" y1="12" x2="20" y2="12" />
                    <line
                      x1="12"
                      y1="6"
                      x2="12"
                      y2="18"
                      strokeDasharray="2 2"
                    />
                  </svg>
                  <span className="ribbon-tool-label">Split</span>
                </button>
                <button
                  type="button"
                  onClick={handleExtendWall}
                  className="ribbon-tool-btn"
                  disabled={
                    !selectedBimElement || selectedBimElement.type !== "wall"
                  }
                  title={`Extend Wall by ${moveDistance}m`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="4" y1="12" x2="16" y2="12" />
                    <line
                      x1="16"
                      y1="12"
                      x2="20"
                      y2="12"
                      strokeDasharray="2 2"
                    />
                    <polyline points="18,9 21,12 18,15" />
                  </svg>
                  <span className="ribbon-tool-label">Extend</span>
                </button>
                <button
                  type="button"
                  onClick={handleTrimWall}
                  className="ribbon-tool-btn"
                  disabled={
                    !selectedBimElement || selectedBimElement.type !== "wall"
                  }
                  title={`Trim Wall by ${moveDistance}m`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="4" y1="12" x2="16" y2="12" />
                    <line x1="16" y1="8" x2="20" y2="16" />
                    <line x1="16" y1="16" x2="20" y2="8" />
                  </svg>
                  <span className="ribbon-tool-label">Trim</span>
                </button>
              </div>
              <div className="ribbon-group-label">Wall Edit</div>
            </div>

            {/* Align & Distribute */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={handleAlignLeft}
                  className="ribbon-tool-btn"
                  disabled={selectedElements.length < 2}
                  title="Align Left (min X)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="4" y1="4" x2="4" y2="20" />
                    <rect x="4" y="6" width="12" height="4" />
                    <rect x="4" y="14" width="8" height="4" />
                  </svg>
                  <span className="ribbon-tool-label">Left</span>
                </button>
                <button
                  type="button"
                  onClick={handleAlignRight}
                  className="ribbon-tool-btn"
                  disabled={selectedElements.length < 2}
                  title="Align Right (max X)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="20" y1="4" x2="20" y2="20" />
                    <rect x="8" y="6" width="12" height="4" />
                    <rect x="12" y="14" width="8" height="4" />
                  </svg>
                  <span className="ribbon-tool-label">Right</span>
                </button>
                <button
                  type="button"
                  onClick={handleAlignTop}
                  className="ribbon-tool-btn"
                  disabled={selectedElements.length < 2}
                  title="Align Top (min Z)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <line x1="4" y1="4" x2="20" y2="4" />
                    <rect x="6" y="4" width="4" height="12" />
                    <rect x="14" y="4" width="4" height="8" />
                  </svg>
                  <span className="ribbon-tool-label">Top</span>
                </button>
                <button
                  type="button"
                  onClick={handleDistributeX}
                  className="ribbon-tool-btn"
                  disabled={selectedElements.length < 3}
                  title="Distribute evenly along X"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="2" y="8" width="4" height="8" />
                    <rect x="10" y="8" width="4" height="8" />
                    <rect x="18" y="8" width="4" height="8" />
                    <line
                      x1="4"
                      y1="20"
                      x2="20"
                      y2="20"
                      strokeDasharray="2 2"
                    />
                  </svg>
                  <span className="ribbon-tool-label">Dist X</span>
                </button>
                <button
                  type="button"
                  onClick={handleDistributeZ}
                  className="ribbon-tool-btn"
                  disabled={selectedElements.length < 3}
                  title="Distribute evenly along Z"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="8" y="2" width="8" height="4" />
                    <rect x="8" y="10" width="8" height="4" />
                    <rect x="8" y="18" width="8" height="4" />
                    <line
                      x1="20"
                      y1="4"
                      x2="20"
                      y2="20"
                      strokeDasharray="2 2"
                    />
                  </svg>
                  <span className="ribbon-tool-label">Dist Z</span>
                </button>
              </div>
              <div className="ribbon-group-label">Align</div>
            </div>

            {/* Constraints */}
            {onConstraintsChange && (
              <div className="ribbon-group">
                <div className="ribbon-group-tools">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedElements.length !== 2) return;
                      const a = selectedElements[0];
                      const b = selectedElements[1];
                      const dx =
                        (a.start.x + a.end.x) / 2 - (b.start.x + b.end.x) / 2;
                      const dz =
                        (a.start.z + a.end.z) / 2 - (b.start.z + b.end.z) / 2;
                      const dist = Math.sqrt(dx * dx + dz * dz);
                      const c: BimConstraint = {
                        id: crypto.randomUUID(),
                        type: "distance",
                        elementIds: [a.id, b.id],
                        value: Math.round(dist * 100) / 100,
                      };
                      onConstraintsChange([...constraints, c]);
                    }}
                    className="ribbon-tool-btn"
                    disabled={selectedElements.length !== 2}
                    title="Lock distance between 2 selected elements"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <rect x="6" y="10" width="12" height="8" rx="1" />
                      <path d="M8 10 V7 A4 4 0 0 1 16 7 V10" />
                    </svg>
                    <span className="ribbon-tool-label">Lock Dist</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedElements.length < 2) return;
                      const c: BimConstraint = {
                        id: crypto.randomUUID(),
                        type: "alignment",
                        elementIds: selectedElements.map((e) => e.id),
                        axis: "x",
                      };
                      onConstraintsChange([...constraints, c]);
                    }}
                    className="ribbon-tool-btn"
                    disabled={selectedElements.length < 2}
                    title="Lock X-alignment of selected elements"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <line
                        x1="12"
                        y1="3"
                        x2="12"
                        y2="21"
                        strokeDasharray="3 2"
                      />
                      <rect x="8" y="6" width="8" height="4" />
                      <rect x="8" y="14" width="8" height="4" />
                    </svg>
                    <span className="ribbon-tool-label">Align X</span>
                  </button>
                  {constraints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onConstraintsChange([])}
                      className="ribbon-tool-btn"
                      title="Clear all constraints"
                    >
                      <span className="ribbon-tool-label">
                        Clear ({constraints.length})
                      </span>
                    </button>
                  )}
                </div>
                <div className="ribbon-group-label">Constraints</div>
              </div>
            )}

            {/* Group/Ungroup */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={onGroupSelected}
                  className="ribbon-tool-btn"
                  disabled={selectedElementIds.length < 2}
                  title="Group selected elements (Ctrl+G)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="2" y="2" width="8" height="8" rx="1" />
                    <rect x="14" y="14" width="8" height="8" rx="1" />
                    <path d="M10 6 L14 6 M6 10 L6 14" strokeDasharray="2 1" />
                  </svg>
                  <span className="ribbon-tool-label">Group</span>
                </button>
                <button
                  type="button"
                  onClick={onUngroupSelected}
                  className="ribbon-tool-btn"
                  disabled={!selectedBimElement?.groupId}
                  title="Ungroup selected element"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="2" y="2" width="8" height="8" rx="1" />
                    <rect x="14" y="14" width="8" height="8" rx="1" />
                    <line x1="10" y1="6" x2="14" y2="6" strokeDasharray="2 1" />
                    <line
                      x1="8"
                      y1="4"
                      x2="16"
                      y2="12"
                      stroke="#ef4444"
                      strokeWidth={2}
                    />
                  </svg>
                  <span className="ribbon-tool-label">Ungroup</span>
                </button>
              </div>
              <div className="ribbon-group-label">Group</div>
            </div>

            {/* Pin/Unpin */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={handleTogglePin}
                  className={`ribbon-tool-btn ${selectedBimElement?.pinned ? "ribbon-tool-active" : ""}`}
                  disabled={!selectedBimElement}
                  title={
                    selectedBimElement?.pinned
                      ? "Unpin Element (allow editing)"
                      : "Pin Element (lock position)"
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill={selectedBimElement?.pinned ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M12 2 L14 8 L20 10 L16 14 L17 22 L12 18 L7 22 L8 14 L4 10 L10 8 Z" />
                  </svg>
                  <span className="ribbon-tool-label">
                    {selectedBimElement?.pinned ? "Unpin" : "Pin"}
                  </span>
                </button>
              </div>
              <div className="ribbon-group-label">Lock</div>
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
            {/* AI Generation group */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={onAiGenerate}
                  className="ribbon-tool-btn"
                  title="Generate BIM elements from a floor plan image using AI"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  <span className="ribbon-tool-label">Image{"\n"}to BIM</span>
                </button>
              </div>
              <div className="ribbon-group-label">AI</div>
            </div>
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
            {/* Layout presets group */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                {(
                  [
                    { id: "single", label: "Single", key: "1" },
                    { id: "2-up", label: "2-Up", key: "2" },
                    { id: "3-up", label: "3-Up", key: "3" },
                    { id: "4-up", label: "4-Up", key: "4" },
                  ] as { id: ViewLayout; label: string; key: string }[]
                ).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onLayoutChange(l.id)}
                    className={`ribbon-tool-btn ${viewLayout === l.id ? "active" : ""}`}
                    title={`${l.label} Layout (${l.key})`}
                  >
                    {l.id === "single" ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                    ) : l.id === "2-up" ? (
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
                    ) : l.id === "3-up" ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="12" y1="3" x2="12" y2="21" />
                        <line x1="12" y1="12" x2="21" y2="12" />
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
                        <line x1="12" y1="3" x2="12" y2="21" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                      </svg>
                    )}
                    <span className="ribbon-tool-label">{l.label}</span>
                  </button>
                ))}
              </div>
              <div className="ribbon-group-label">Layout</div>
            </div>

            {/* Add view group */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={() => onAddPane("3d")}
                  className="ribbon-tool-btn"
                  title="Add 3D View"
                  disabled={viewPanes.length >= 4}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z" />
                    <path d="M12 2 L12 22" />
                  </svg>
                  <span className="ribbon-tool-label">3D</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAddPane("plan")}
                  className="ribbon-tool-btn"
                  title="Add Plan View"
                  disabled={viewPanes.length >= 4}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="3" y="3" width="18" height="18" rx="1" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="12" y1="3" x2="12" y2="21" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  <span className="ribbon-tool-label">Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAddPane("front-elevation")}
                  className="ribbon-tool-btn"
                  title="Add Front Elevation"
                  disabled={viewPanes.length >= 4}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="3" y="6" width="18" height="14" rx="1" />
                    <path d="M3 12 L12 6 L21 12" />
                  </svg>
                  <span className="ribbon-tool-label">Elev.</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAddPane("section")}
                  className="ribbon-tool-btn"
                  title="Add Section View"
                  disabled={viewPanes.length >= 4}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="3" y="3" width="18" height="18" rx="1" />
                    <line
                      x1="3"
                      y1="12"
                      x2="21"
                      y2="12"
                      strokeDasharray="3 2"
                    />
                    <path d="M12 8 L14 12 L12 16" />
                  </svg>
                  <span className="ribbon-tool-label">Section</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAddPane("2d-sheet")}
                  className="ribbon-tool-btn"
                  title="Add 2D Sheet"
                  disabled={viewPanes.length >= 4}
                >
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
                  <span className="ribbon-tool-label">Sheet</span>
                </button>
              </div>
              <div className="ribbon-group-label">Add View</div>
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
                        {level.name} ({formatUnit(level.height, unitSystem)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="ribbon-group-label">Level</div>
            </div>

            {/* Navigation group */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={onZoomIn}
                  className="ribbon-tool-btn"
                  title="Zoom In"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                  <span className="ribbon-tool-label">Zoom +</span>
                </button>
                <button
                  type="button"
                  onClick={onZoomOut}
                  className="ribbon-tool-btn"
                  title="Zoom Out"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                  <span className="ribbon-tool-label">Zoom −</span>
                </button>
                <button
                  type="button"
                  onClick={onZoomToFit}
                  className="ribbon-tool-btn"
                  title="Zoom to Fit (show all elements)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M3 8V5a2 2 0 0 1 2-2h3" />
                    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                    <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
                    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                    <rect x="7" y="7" width="10" height="10" rx="1" />
                  </svg>
                  <span className="ribbon-tool-label">Fit All</span>
                </button>
              </div>
              <div className="ribbon-group-label">Navigation</div>
            </div>

            {/* Section Box */}
            {onSectionBoxChange && sectionBox && (
              <div className="ribbon-group">
                <div className="ribbon-group-tools">
                  <button
                    type="button"
                    onClick={() =>
                      onSectionBoxChange({
                        ...sectionBox,
                        enabled: !sectionBox.enabled,
                      })
                    }
                    className={`ribbon-tool-btn ${sectionBox.enabled ? "ribbon-tool-active" : ""}`}
                    title="Toggle Section Box"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path d="M3 8 L12 3 L21 8 L21 16 L12 21 L3 16 Z" />
                      <path d="M3 8 L12 13 L21 8" />
                      <line x1="12" y1="13" x2="12" y2="21" />
                    </svg>
                    <span className="ribbon-tool-label">
                      {sectionBox.enabled ? "Hide" : "Box"}
                    </span>
                  </button>
                  {sectionBox.enabled && (
                    <button
                      type="button"
                      onClick={() =>
                        onSectionBoxChange({
                          enabled: true,
                          min: { x: -10, y: -1, z: -10 },
                          max: { x: 10, y: 10, z: 10 },
                        })
                      }
                      className="ribbon-tool-btn"
                      title="Reset Section Box to default size"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path d="M4 12 A8 8 0 1 1 12 20" />
                        <polyline points="4,8 4,12 8,12" />
                      </svg>
                      <span className="ribbon-tool-label">Reset</span>
                    </button>
                  )}
                </div>
                <div className="ribbon-group-label">Section Box</div>
              </div>
            )}

            {/* View Filters - Color By */}
            {onViewFilterChange && (
              <div className="ribbon-group">
                <div className="ribbon-group-tools">
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "9px",
                        color: "var(--revit-text-dim, #999)",
                      }}
                    >
                      Color By
                    </span>
                    <select
                      value={viewFilterColorBy}
                      onChange={(e) =>
                        onViewFilterChange(e.target.value as ViewFilterColorBy)
                      }
                      style={{
                        width: "80px",
                        height: "22px",
                        fontSize: "10px",
                        border: "1px solid var(--revit-border)",
                        borderRadius: "2px",
                        background: "var(--revit-input-bg, #2a2a2a)",
                        color: "var(--revit-text)",
                        padding: "0 4px",
                        cursor: "pointer",
                      }}
                    >
                      <option value="none">None</option>
                      <option value="type">Type</option>
                      <option value="level">Level</option>
                      <option value="phase">Phase</option>
                      <option value="material">Material</option>
                    </select>
                  </div>
                </div>
                <div className="ribbon-group-label">View Filter</div>
              </div>
            )}

            {/* Detail Level */}
            {onDetailLevelChange && (
              <div className="ribbon-group">
                <div className="ribbon-group-tools">
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "9px",
                        color: "var(--revit-text-dim, #999)",
                      }}
                    >
                      Detail
                    </span>
                    <select
                      value={detailLevel}
                      onChange={(e) =>
                        onDetailLevelChange(e.target.value as DetailLevel)
                      }
                      style={{
                        width: "72px",
                        height: "22px",
                        fontSize: "10px",
                        border: "1px solid var(--revit-border)",
                        borderRadius: "2px",
                        background: "var(--revit-input-bg, #2a2a2a)",
                        color: "var(--revit-text)",
                        padding: "0 4px",
                        cursor: "pointer",
                      }}
                    >
                      <option value="coarse">Coarse</option>
                      <option value="medium">Medium</option>
                      <option value="fine">Fine</option>
                    </select>
                  </div>
                </div>
                <div className="ribbon-group-label">Detail Level</div>
              </div>
            )}

            {/* Sun Study */}
            {onSunHourChange && (
              <div className="ribbon-group">
                <div className="ribbon-group-tools">
                  <button
                    type="button"
                    onClick={() =>
                      onSunHourChange(sunHour !== null ? null : 12)
                    }
                    className={`ribbon-tool-btn ${sunHour !== null ? "ribbon-tool-active" : ""}`}
                    title={
                      sunHour !== null
                        ? "Disable shadows"
                        : "Enable sun/shadow study"
                    }
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill={sunHour !== null ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="4" />
                      <line x1="12" y1="20" x2="12" y2="23" />
                      <line x1="1" y1="12" x2="4" y2="12" />
                      <line x1="20" y1="12" x2="23" y2="12" />
                      <line x1="4.2" y1="4.2" x2="6.3" y2="6.3" />
                      <line x1="17.7" y1="17.7" x2="19.8" y2="19.8" />
                      <line x1="4.2" y1="19.8" x2="6.3" y2="17.7" />
                      <line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />
                    </svg>
                    <span className="ribbon-tool-label">
                      {sunHour !== null ? `${Math.round(sunHour)}h` : "Sun"}
                    </span>
                  </button>
                  {sunHour !== null && (
                    <input
                      type="range"
                      min="5"
                      max="20"
                      step="0.5"
                      value={sunHour}
                      onChange={(e) =>
                        onSunHourChange(Number.parseFloat(e.target.value))
                      }
                      title={`Sun time: ${Math.floor(sunHour)}:${String(Math.round((sunHour % 1) * 60)).padStart(2, "0")}`}
                      style={{
                        width: "80px",
                        height: "20px",
                        cursor: "pointer",
                      }}
                    />
                  )}
                </div>
                <div className="ribbon-group-label">Sun Study</div>
              </div>
            )}

            {/* View Templates */}
            {onSaveViewTemplate && (
              <div className="ribbon-group">
                <div className="ribbon-group-tools">
                  <button
                    type="button"
                    onClick={onSaveViewTemplate}
                    className="ribbon-tool-btn"
                    title="Save current view settings as a template"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    <span className="ribbon-tool-label">Save</span>
                  </button>
                  {viewTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onLoadViewTemplate?.(t)}
                      className="ribbon-tool-btn"
                      title={`Load template: ${t.name}`}
                      style={{
                        fontSize: "9px",
                        maxWidth: "48px",
                        overflow: "hidden",
                      }}
                    >
                      <span className="ribbon-tool-label">{t.name}</span>
                    </button>
                  ))}
                </div>
                <div className="ribbon-group-label">Templates</div>
              </div>
            )}
          </div>
        )}
        {activeTab === "manage" && (
          <div className="ribbon-panel-content">
            {/* Visibility / Graphics */}
            <div className="ribbon-group">
              <div
                className="ribbon-group-tools"
                style={{ flexWrap: "wrap", maxWidth: 280 }}
              >
                {(
                  [
                    "wall",
                    "column",
                    "door",
                    "window",
                    "slab",
                    "beam",
                    "roof",
                    "room",
                    "stair",
                    "railing",
                    "curtainWall",
                    "duct",
                    "pipe",
                    "lightFixture",
                    "table",
                    "chair",
                    "desk",
                    "shelving",
                    "toilet",
                    "sink",
                  ] as BimElementType[]
                ).map((type) => {
                  const vis = categoryVisibility[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        onCategoryVisibilityChange(type, {
                          visible: !vis?.visible,
                        })
                      }
                      className={`ribbon-tool-btn ${vis?.visible === false ? "muted" : ""}`}
                      title={`${vis?.visible === false ? "Show" : "Hide"} ${type}s`}
                      style={{
                        opacity: vis?.visible === false ? 0.35 : 1,
                        minWidth: 36,
                        padding: "2px 4px",
                      }}
                    >
                      <span className="text-[9px] font-mono font-bold">
                        {type.charAt(0).toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="ribbon-group-label">Visibility</div>
            </div>

            {/* Saved Views */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={onSaveView}
                  className="ribbon-tool-btn"
                  title="Save current camera view"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="12" cy="12" r="4" />
                    <line x1="12" y1="2" x2="12" y2="5" />
                  </svg>
                  <span className="ribbon-tool-label">Save</span>
                </button>
                {savedViews.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onLoadView(v)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onDeleteView(v.id);
                    }}
                    className="ribbon-tool-btn"
                    title={`Load view: ${v.name} (right-click to delete)`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path d="M1 12 Q12 4 23 12 Q12 20 1 12" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span className="ribbon-tool-label" style={{ fontSize: 8 }}>
                      {v.name.length > 6 ? `${v.name.slice(0, 6)}..` : v.name}
                    </span>
                  </button>
                ))}
              </div>
              <div className="ribbon-group-label">Saved Views</div>
            </div>

            {/* Schedules */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                {(
                  [
                    { id: "door", label: "Door" },
                    { id: "window", label: "Window" },
                    { id: "room", label: "Room" },
                    { id: "wall", label: "Wall" },
                    { id: "all", label: "All" },
                  ] as { id: ScheduleType; label: string }[]
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOpenSchedule(s.id)}
                    className="ribbon-tool-btn"
                    title={`${s.label} Schedule`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="1" />
                      <line x1="3" y1="8" x2="21" y2="8" />
                      <line x1="3" y1="13" x2="21" y2="13" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                      <line x1="10" y1="3" x2="10" y2="21" />
                    </svg>
                    <span className="ribbon-tool-label">{s.label}</span>
                  </button>
                ))}
              </div>
              <div className="ribbon-group-label">Schedules</div>
            </div>

            {/* Keynote Legend */}
            {onOpenKeynoteLegend && (
              <div className="ribbon-group">
                <div className="ribbon-group-tools">
                  <button
                    type="button"
                    onClick={onOpenKeynoteLegend}
                    className="ribbon-tool-btn"
                    title="Open Keynote Legend"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="1" />
                      <line x1="7" y1="8" x2="17" y2="8" />
                      <line x1="7" y1="12" x2="17" y2="12" />
                      <line x1="7" y1="16" x2="14" y2="16" />
                    </svg>
                    <span className="ribbon-tool-label">Legend</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Keynotes</div>
              </div>
            )}

            {/* Clash Detection */}
            <div className="ribbon-group">
              <div className="ribbon-group-tools">
                <button
                  type="button"
                  onClick={() => {
                    const clashes = detectClashes(bimElements);
                    if (clashes.length === 0) {
                      alert("No clashes detected!");
                    } else {
                      alert(
                        `${clashes.length} clash(es) found:\n\n${clashes
                          .slice(0, 10)
                          .map((c) => `- ${c.description}`)
                          .join(
                            "\n",
                          )}${clashes.length > 10 ? `\n...and ${clashes.length - 10} more` : ""}`,
                      );
                    }
                  }}
                  className="ribbon-tool-btn"
                  disabled={bimElements.length < 2}
                  title="Check for clashing elements"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <circle cx="9" cy="9" r="6" />
                    <circle cx="15" cy="15" r="6" />
                    <path d="M12 6 L12 12 L18 12" strokeDasharray="2 2" />
                  </svg>
                  <span className="ribbon-tool-label">Clashes</span>
                </button>
              </div>
              <div className="ribbon-group-label">Clash Detection</div>
            </div>

            {/* Sheet Composer */}
            {onOpenSheetComposer && (
              <div className="ribbon-group">
                <div className="ribbon-group-tools">
                  <button
                    type="button"
                    onClick={onOpenSheetComposer}
                    className="ribbon-tool-btn"
                    title="Open Sheet Composer"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="1" />
                      <line x1="3" y1="7" x2="21" y2="7" />
                      <rect
                        x="5"
                        y="9"
                        width="8"
                        height="6"
                        rx="0.5"
                        strokeDasharray="2 1"
                      />
                      <rect
                        x="15"
                        y="9"
                        width="4"
                        height="4"
                        rx="0.5"
                        strokeDasharray="2 1"
                      />
                    </svg>
                    <span className="ribbon-tool-label">Sheets</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Sheets</div>
              </div>
            )}

            {/* Design Options */}
            {onDesignOptionChange && (
              <div className="ribbon-group">
                <div className="ribbon-group-tools">
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt("Design option name:");
                      if (!name) return;
                      const newOpt: DesignOption = {
                        id: crypto.randomUUID(),
                        name,
                        description: "",
                        elementIds: selectedElementIds,
                        active: true,
                      };
                      onDesignOptionChange([...designOptions, newOpt]);
                    }}
                    className="ribbon-tool-btn"
                    title="Create Design Option from selected elements"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path d="M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z" />
                      <line
                        x1="12"
                        y1="3"
                        x2="12"
                        y2="21"
                        strokeDasharray="2 2"
                      />
                    </svg>
                    <span className="ribbon-tool-label">New Opt</span>
                  </button>
                  {designOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const updated = designOptions.map((o) =>
                          o.id === opt.id ? { ...o, active: !o.active } : o,
                        );
                        onDesignOptionChange(updated);
                      }}
                      className={`ribbon-tool-btn ${opt.active ? "ribbon-tool-active" : ""}`}
                      title={`${opt.active ? "Hide" : "Show"}: ${opt.name}`}
                      style={{
                        fontSize: "9px",
                        maxWidth: "48px",
                        overflow: "hidden",
                      }}
                    >
                      <span className="ribbon-tool-label">{opt.name}</span>
                    </button>
                  ))}
                </div>
                <div className="ribbon-group-label">Design Options</div>
              </div>
            )}

            {/* Worksets */}
            {onWorksetsChange && worksets.length > 0 && (
              <div className="ribbon-group">
                <div
                  className="ribbon-group-tools"
                  style={{ flexWrap: "wrap", maxWidth: 200 }}
                >
                  {worksets.map((ws) => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        const updated = worksets.map((w) =>
                          w.id === ws.id ? { ...w, editable: !w.editable } : w,
                        );
                        onWorksetsChange(updated);
                      }}
                      className={`ribbon-tool-btn ${ws.editable ? "ribbon-tool-active" : ""}`}
                      title={`${ws.name} — ${ws.editable ? "Editable" : "Read-only"} (${ws.owner})`}
                      style={{
                        fontSize: "8px",
                        maxWidth: "60px",
                        overflow: "hidden",
                      }}
                    >
                      <span className="ribbon-tool-label">{ws.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt("Workset name:");
                      if (!name) return;
                      const ws: Workset = {
                        id: crypto.randomUUID(),
                        name,
                        owner: "You",
                        editable: true,
                        elementIds: selectedElementIds,
                      };
                      onWorksetsChange([...worksets, ws]);
                    }}
                    className="ribbon-tool-btn"
                    title="Create new workset"
                    style={{ fontSize: "8px" }}
                  >
                    <span className="ribbon-tool-label">+ New</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Worksets</div>
              </div>
            )}

            {/* Topography */}
            {onGenerateTerrain && (
              <div className="ribbon-group">
                <div className="ribbon-group-tools">
                  <button
                    type="button"
                    onClick={onGenerateTerrain}
                    className="ribbon-tool-btn"
                    title="Generate sample terrain surface"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path d="M2 20 L6 14 L10 16 L14 10 L18 13 L22 8" />
                      <line x1="2" y1="20" x2="22" y2="20" />
                    </svg>
                    <span className="ribbon-tool-label">Terrain</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Site</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
