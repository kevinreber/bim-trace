import { useMemo, useState } from "react";
import type {
  BimElement,
  Level,
  Markup,
  SelectedElement,
  SpatialNode,
} from "@/types";
import ElementEditor from "./ElementEditor";
import MarkupList from "./MarkupList";
import PropertyPanel from "./PropertyPanel";

/* ------------------------------------------------------------------ */
/*  Revit-style dual panels:                                           */
/*  Left  = Project Browser (tree + markups + levels)                  */
/*  Right = Properties (element editor / IFC properties)               */
/* ------------------------------------------------------------------ */

interface ProjectBrowserProps {
  tree: SpatialNode[];
  bimElements: BimElement[];
  markups: Markup[];
  selectedElement: SelectedElement | null;
  selectedElementIds: string[];
  onSelectElement: (elementId: string) => void;
  onMarkupStatusChange: (id: string, status: Markup["status"]) => void;
  onMarkupNavigate: (markup: Markup) => void;
  onMarkupLink: (markupId: string) => void;
  levels: Level[];
  activeLevel: string;
  onActiveLevelChange: (id: string) => void;
  onLevelsChange: (levels: Level[]) => void;
}

interface PropertiesPanelProps {
  selectedElement: SelectedElement | null;
  selectedElementIds: string[];
  bimElements: BimElement[];
  markups: Markup[];
  onBimElementUpdate: (id: string, updates: Partial<BimElement>) => void;
  onBimElementDelete: (id: string) => void;
  onBulkDelete: () => void;
  onMarkupStatusChange: (id: string, status: Markup["status"]) => void;
  onMarkupNavigate: (markup: Markup) => void;
  onMarkupLink: (markupId: string) => void;
}

/* ── Tree Node (Revit Project Browser style) ──────────────────────── */

const TYPE_ICONS: Record<string, string> = {
  IFCSITE: "G",
  IFCBUILDING: "B",
  IFCBUILDINGSTOREY: "S",
  IFCSPACE: "R",
  IFCWALL: "W",
  IFCWALLSTANDARDCASE: "W",
  IFCDOOR: "D",
  IFCWINDOW: "N",
  IFCSLAB: "F",
  IFCCOLUMN: "C",
  IFCBEAM: "M",
  IFCSTAIR: "T",
  IFCROOF: "^",
  wall: "W",
  column: "C",
  slab: "S",
  door: "D",
  window: "N",
  beam: "B",
  ceiling: "G",
  roof: "^",
  stair: "A",
  railing: "I",
  curtainWall: "K",
  table: "T",
  chair: "H",
  shelving: "L",
  desk: "K",
  toilet: "O",
  sink: "J",
  duct: "U",
  pipe: "P",
  lightFixture: "F",
};

function TreeNode({
  node,
  depth,
  selectedNames,
  onSelect,
}: {
  node: SpatialNode;
  depth: number;
  selectedNames?: Set<string>;
  onSelect?: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const icon = TYPE_ICONS[node.type] || "*";
  const isLeaf = !hasChildren;
  const isSelected = selectedNames?.has(node.name) ?? false;

  const handleClick = () => {
    if (hasChildren) {
      setExpanded(!expanded);
    }
    // For leaf nodes, trigger selection
    if (isLeaf && onSelect) {
      onSelect(node.name);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="tree-node-btn"
        style={{
          paddingLeft: `${depth * 14 + 8}px`,
          background: isSelected ? "var(--ribbon-tool-active)" : undefined,
          color: isSelected ? "white" : undefined,
        }}
      >
        {hasChildren ? (
          <span className={`tree-node-expand ${expanded ? "open" : ""}`}>
            ▶
          </span>
        ) : (
          <span className="tree-node-expand" style={{ visibility: "hidden" }}>
            ▶
          </span>
        )}
        <span className="tree-node-icon">{icon}</span>
        <span className="truncate flex-1">{node.name}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <TreeNode
              key={child.expressID || `${child.type}-${idx}`}
              node={child}
              depth={depth + 1}
              selectedNames={selectedNames}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Level Manager (Revit-style) ──────────────────────────────────── */

function LevelManager({
  levels,
  activeLevel,
  onActiveLevelChange,
  onLevelsChange,
}: {
  levels: Level[];
  activeLevel: string;
  onActiveLevelChange: (id: string) => void;
  onLevelsChange: (levels: Level[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleVisibility = (id: string) => {
    onLevelsChange(
      levels.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    );
  };

  const updateLevelName = (id: string, name: string) => {
    onLevelsChange(levels.map((l) => (l.id === id ? { ...l, name } : l)));
  };

  const updateLevelHeight = (id: string, height: number) => {
    onLevelsChange(levels.map((l) => (l.id === id ? { ...l, height } : l)));
  };

  const addLevel = () => {
    const maxHeight = Math.max(...levels.map((l) => l.height));
    const newLevel: Level = {
      id: `level-${crypto.randomUUID().slice(0, 8)}`,
      name: `Level ${levels.length}`,
      height: maxHeight + 3,
      visible: true,
    };
    onLevelsChange([...levels, newLevel]);
  };

  const removeLevel = (id: string) => {
    if (levels.length <= 1) return;
    onLevelsChange(levels.filter((l) => l.id !== id));
    if (activeLevel === id) {
      onActiveLevelChange(levels[0].id === id ? levels[1].id : levels[0].id);
    }
  };

  return (
    <div className="flex flex-col">
      {levels
        .sort((a, b) => b.height - a.height)
        .map((level) => (
          <div key={level.id} className="prop-row" style={{ minHeight: 30 }}>
            <button
              type="button"
              onClick={() => toggleVisibility(level.id)}
              className="flex items-center justify-center w-6 shrink-0 ml-2"
              style={{
                color: level.visible
                  ? "var(--accent-blue)"
                  : "var(--text-muted)",
              }}
              title={level.visible ? "Hide level" : "Show level"}
            >
              <svg
                viewBox="0 0 16 16"
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                {level.visible ? (
                  <path d="M1 8 Q8 2 15 8 Q8 14 1 8 M8 6 A2 2 0 1 1 8 10 A2 2 0 1 1 8 6" />
                ) : (
                  <>
                    <path d="M1 8 Q8 2 15 8 Q8 14 1 8" />
                    <line x1="2" y1="2" x2="14" y2="14" />
                  </>
                )}
              </svg>
            </button>

            <button
              type="button"
              onClick={() => onActiveLevelChange(level.id)}
              onDoubleClick={() => setEditingId(level.id)}
              className="flex-1 text-left px-2"
            >
              {editingId === level.id ? (
                <input
                  type="text"
                  value={level.name}
                  onChange={(e) => updateLevelName(level.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setEditingId(null);
                  }}
                  className="prop-input"
                  style={{ width: "100%" }}
                />
              ) : (
                <span
                  className="text-[11px]"
                  style={{
                    color:
                      activeLevel === level.id
                        ? "var(--accent-blue)"
                        : "var(--text-secondary)",
                    fontWeight: activeLevel === level.id ? 600 : 400,
                  }}
                >
                  {level.name}
                </span>
              )}
            </button>

            <input
              type="number"
              value={level.height}
              step={0.5}
              onChange={(e) => {
                const val = Number.parseFloat(e.target.value);
                if (!Number.isNaN(val)) updateLevelHeight(level.id, val);
              }}
              className="prop-input"
              style={{ width: 52, textAlign: "right" }}
            />
            <span className="prop-unit">m</span>

            <button
              type="button"
              onClick={() => removeLevel(level.id)}
              className="px-2 flex items-center justify-center"
              style={{ color: "var(--text-muted)" }}
              title="Remove level"
            >
              <svg
                viewBox="0 0 16 16"
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <line x1="4" y1="4" x2="12" y2="12" />
                <line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
          </div>
        ))}

      <button
        type="button"
        onClick={addLevel}
        className="tree-node-btn"
        style={{ color: "var(--accent-blue)", padding: "6px 10px" }}
      >
        <svg
          viewBox="0 0 16 16"
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <line x1="8" y1="3" x2="8" y2="13" />
          <line x1="3" y1="8" x2="13" y2="8" />
        </svg>
        <span className="text-[11px]">Add Level</span>
      </button>
    </div>
  );
}

/* ── Project Browser (left panel) ─────────────────────────────────── */

type BrowserTab = "tree" | "markups" | "levels";

export function ProjectBrowser({
  tree,
  bimElements,
  markups,
  selectedElement,
  selectedElementIds,
  onSelectElement,
  onMarkupStatusChange,
  onMarkupNavigate,
  onMarkupLink,
  levels,
  activeLevel,
  onActiveLevelChange,
  onLevelsChange,
}: ProjectBrowserProps) {
  const [activeTab, setActiveTab] = useState<BrowserTab>("tree");

  const authoredTree: SpatialNode[] = useMemo(() => {
    if (bimElements.length === 0) return [];
    const byType = new Map<string, BimElement[]>();
    for (const el of bimElements) {
      const list = byType.get(el.type) ?? [];
      list.push(el);
      byType.set(el.type, list);
    }
    return Array.from(byType.entries()).map(([type, elements]) => ({
      expressID: 0,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)}s`,
      children: elements.map((el) => ({
        expressID: 0,
        type: el.type,
        name: el.name,
        children: [],
      })),
    }));
  }, [bimElements]);

  const handleTreeSelect = (name: string) => {
    const el = bimElements.find((e) => e.name === name);
    if (el) {
      onSelectElement(el.id);
    }
  };

  const selectedNames = useMemo(() => {
    const names = new Set<string>();
    for (const id of selectedElementIds) {
      const el = bimElements.find((e) => e.id === id);
      if (el) names.add(el.name);
    }
    return names;
  }, [selectedElementIds, bimElements]);

  return (
    <div className="browser-panel">
      <div className="browser-header">
        <span>Project Browser</span>
        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
          {countNodes(tree) + bimElements.length} items
        </span>
      </div>

      <div className="browser-tabs">
        {(
          [
            { id: "tree", label: "Elements" },
            {
              id: "markups",
              label: `Markups${markups.length > 0 ? ` (${markups.length})` : ""}`,
            },
            { id: "levels", label: "Levels" },
          ] as { id: BrowserTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`browser-tab ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "tree" &&
          (tree.length === 0 && bimElements.length === 0 ? (
            <div
              className="p-4 text-center"
              style={{ color: "var(--text-muted)" }}
            >
              <p className="text-[11px]">No model loaded</p>
              <p className="text-[10px] mt-1">
                Drop an .ifc file or use Architecture tools
              </p>
            </div>
          ) : (
            <div className="py-0.5">
              {tree.map((node, idx) => (
                <TreeNode
                  key={node.expressID || `root-${idx}`}
                  node={node}
                  depth={0}
                />
              ))}
              {authoredTree.length > 0 && (
                <>
                  {tree.length > 0 && (
                    <div
                      style={{
                        borderTop: "1px solid var(--border)",
                        margin: "4px 0",
                      }}
                    />
                  )}
                  <div
                    className="prop-section-header"
                    style={{ cursor: "default" }}
                  >
                    <span className="status-dot green" />
                    Authored Elements
                  </div>
                  {authoredTree.map((node) => (
                    <TreeNode
                      key={`authored-${node.type}`}
                      node={node}
                      depth={0}
                      selectedNames={selectedNames}
                      onSelect={handleTreeSelect}
                    />
                  ))}
                </>
              )}
            </div>
          ))}

        {activeTab === "markups" && (
          <MarkupList
            markups={markups}
            onStatusChange={onMarkupStatusChange}
            onNavigate={onMarkupNavigate}
            onLink={onMarkupLink}
            selectedElement={selectedElement}
          />
        )}

        {activeTab === "levels" && (
          <LevelManager
            levels={levels}
            activeLevel={activeLevel}
            onActiveLevelChange={onActiveLevelChange}
            onLevelsChange={onLevelsChange}
          />
        )}
      </div>

      {/* Footer status */}
      <div
        className="status-bar"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="status-bar-section">
          {bimElements.length > 0 && (
            <span className="status-indicator">
              <span className="status-dot green" />
              {bimElements.length} authored
            </span>
          )}
          {markups.filter((m) => m.status === "open").length > 0 && (
            <span className="status-indicator">
              <span className="status-dot" style={{ background: "#ef4444" }} />
              {markups.filter((m) => m.status === "open").length} open
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Properties Panel (right panel) ───────────────────────────────── */

export function PropertiesPanel({
  selectedElement,
  selectedElementIds,
  bimElements,
  markups,
  onBimElementUpdate,
  onBimElementDelete,
  onBulkDelete,
  onMarkupStatusChange,
  onMarkupNavigate,
  onMarkupLink,
}: PropertiesPanelProps) {
  const selectedBimElement = bimElements.find(
    (el) => el.id === selectedElement?.globalId,
  );

  const multiSelectCount = selectedElementIds.length;
  const isMultiSelect = multiSelectCount > 1;

  const linkedCount = selectedElement
    ? markups.filter((m) => m.linkedBimGuid === selectedElement.globalId).length
    : 0;

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <span>Properties</span>
        {isMultiSelect && (
          <span className="text-[9px]" style={{ color: "var(--accent-blue)" }}>
            {multiSelectCount} selected
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isMultiSelect ? (
          <div className="prop-grid animate-fade-in">
            <div className="properties-type-selector">
              <span className="properties-type-badge">
                {multiSelectCount} Elements Selected
              </span>
            </div>
            <div className="prop-section">
              <div
                className="prop-section-header"
                style={{ cursor: "default" }}
              >
                Selection Summary
              </div>
              {(() => {
                const typeCounts = new Map<string, number>();
                for (const id of selectedElementIds) {
                  const el = bimElements.find((e) => e.id === id);
                  if (el)
                    typeCounts.set(el.type, (typeCounts.get(el.type) ?? 0) + 1);
                }
                return Array.from(typeCounts.entries()).map(([type, count]) => (
                  <div key={type} className="prop-row">
                    <span
                      className="prop-label"
                      style={{ textTransform: "capitalize" }}
                    >
                      {type}
                    </span>
                    <div className="prop-value">
                      <span
                        className="prop-input"
                        style={{
                          background: "none",
                          color: "var(--text-muted)",
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>
            <div style={{ padding: "8px 10px" }}>
              <button
                type="button"
                onClick={onBulkDelete}
                className="w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded text-[11px] transition-colors"
                style={{
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  background: "rgba(239, 68, 68, 0.08)",
                }}
              >
                <svg
                  viewBox="0 0 16 16"
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M3 4 L13 4 M5 4 L5 2 L11 2 L11 4 M4 4 L4 14 L12 14 L12 4" />
                  <line x1="7" y1="7" x2="7" y2="11" />
                  <line x1="9" y1="7" x2="9" y2="11" />
                </svg>
                Delete {multiSelectCount} Elements
              </button>
            </div>
          </div>
        ) : !selectedElement && !selectedBimElement ? (
          <div
            className="p-4 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-8 h-8 mx-auto mb-2 opacity-30"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path d="M4 4 L4 18 L10 13 L16 19" />
              <path d="M4 4 L15 8 L10 13" />
            </svg>
            <p className="text-[11px]">No element selected</p>
            <p className="text-[10px] mt-1">
              Select an element to view properties
            </p>
          </div>
        ) : selectedBimElement ? (
          <ElementEditor
            element={selectedBimElement}
            onUpdate={onBimElementUpdate}
            onDelete={onBimElementDelete}
          />
        ) : (
          <PropertyPanel element={selectedElement} />
        )}

        {selectedElement && linkedCount > 0 && (
          <div className="prop-section">
            <div className="prop-section-header">
              <span className="status-dot blue" />
              Linked Markups ({linkedCount})
            </div>
            <MarkupList
              markups={markups}
              onStatusChange={onMarkupStatusChange}
              onNavigate={onMarkupNavigate}
              onLink={onMarkupLink}
              selectedElement={selectedElement}
              filterByGuid={selectedElement.globalId}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Legacy default export for backward compatibility ─────────────── */

export default function Sidebar() {
  return null;
}

function countNodes(nodes: SpatialNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countNodes(node.children);
  }
  return count;
}
