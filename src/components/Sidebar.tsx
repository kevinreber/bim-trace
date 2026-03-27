import { useMemo, useState } from "react";
import type { BimElement, Markup, SelectedElement, SpatialNode } from "@/types";
import ElementEditor from "./ElementEditor";
import MarkupList from "./MarkupList";
import PropertyPanel from "./PropertyPanel";

interface SidebarProps {
  tree: SpatialNode[];
  selectedElement: SelectedElement | null;
  markups: Markup[];
  onMarkupStatusChange: (id: string, status: Markup["status"]) => void;
  onMarkupNavigate: (markup: Markup) => void;
  onMarkupLink: (markupId: string) => void;
  bimElements: BimElement[];
  onBimElementUpdate: (id: string, updates: Partial<BimElement>) => void;
  onBimElementDelete: (id: string) => void;
}

type Tab = "tree" | "properties" | "markups";

const TABS: { id: Tab; label: string }[] = [
  { id: "tree", label: "Tree" },
  { id: "properties", label: "Properties" },
  { id: "markups", label: "Markups" },
];

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
  // Authored element types
  wall: "W",
  column: "C",
  slab: "S",
  door: "D",
  window: "N",
  beam: "B",
  ceiling: "G",
  table: "T",
  chair: "H",
  shelving: "L",
};

function TreeNode({ node, depth }: { node: SpatialNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const icon = TYPE_ICONS[node.type] || "*";
  const shortType = node.type.replace("IFC", "");

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-sm hover:bg-slate-700/50 rounded transition-colors group"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span
            className={`text-xs text-slate-500 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
        ) : (
          <span className="text-xs text-transparent">▶</span>
        )}
        <span className="w-4 h-4 flex items-center justify-center rounded bg-slate-700/60 text-[9px] font-mono font-bold text-slate-400 shrink-0">
          {icon}
        </span>
        <span className="truncate flex-1 text-slate-300 group-hover:text-white">
          {node.name}
        </span>
        <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
          {shortType}
        </span>
      </button>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <TreeNode
              key={child.expressID || `${child.type}-${idx}`}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  tree,
  selectedElement,
  markups,
  onMarkupStatusChange,
  onMarkupNavigate,
  onMarkupLink,
  bimElements,
  onBimElementUpdate,
  onBimElementDelete,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("tree");

  const linkedCount = selectedElement
    ? markups.filter((m) => m.linkedBimGuid === selectedElement.globalId).length
    : 0;

  // Build authored elements into a spatial-tree-compatible structure
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

  // Check if selected element is an authored BIM element
  const selectedBimElement = bimElements.find(
    (el) => el.id === selectedElement?.globalId,
  );

  return (
    <aside className="w-80 h-full bg-[var(--sidebar-bg)] border-r border-[var(--border)] flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h1 className="text-base font-bold text-white tracking-tight">
          BIM Trace
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800/50"
                : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/30"
            }`}
          >
            {tab.label}
            {tab.id === "markups" && markups.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px]">
                {markups.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "tree" &&
          (tree.length === 0 && bimElements.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-slate-500 text-sm">No model loaded</p>
              <p className="text-slate-600 text-xs mt-1">
                Drop an .ifc file or use the Create toolbar
              </p>
            </div>
          ) : (
            <div className="py-1">
              {/* IFC model tree */}
              {tree.map((node, idx) => (
                <TreeNode
                  key={node.expressID || `root-${idx}`}
                  node={node}
                  depth={0}
                />
              ))}

              {/* Authored elements */}
              {authoredTree.length > 0 && (
                <>
                  {tree.length > 0 && (
                    <div className="mx-2 my-1 border-t border-slate-700/50" />
                  )}
                  <div className="px-2 py-1">
                    <span className="text-[10px] text-green-500 uppercase tracking-wider font-medium">
                      Authored Elements
                    </span>
                  </div>
                  {authoredTree.map((node) => (
                    <TreeNode
                      key={`authored-${node.type}`}
                      node={node}
                      depth={0}
                    />
                  ))}
                </>
              )}
            </div>
          ))}

        {activeTab === "properties" && (
          <div>
            {selectedBimElement ? (
              <ElementEditor
                element={selectedBimElement}
                onUpdate={onBimElementUpdate}
                onDelete={onBimElementDelete}
              />
            ) : (
              <PropertyPanel element={selectedElement} />
            )}
            {/* Trace Engine: linked markups */}
            {selectedElement && linkedCount > 0 && (
              <div className="border-t border-slate-700/50 mt-2">
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-slate-400">
                    Linked Markups
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px]">
                      {linkedCount}
                    </span>
                  </p>
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
        )}

        {activeTab === "markups" && (
          <MarkupList
            markups={markups}
            onStatusChange={onMarkupStatusChange}
            onNavigate={onMarkupNavigate}
            onLink={onMarkupLink}
            selectedElement={selectedElement}
          />
        )}
      </div>

      {/* Footer */}
      {activeTab === "tree" && (tree.length > 0 || bimElements.length > 0) && (
        <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-slate-500 flex items-center justify-between">
          <span>{countNodes(tree)} imported</span>
          {bimElements.length > 0 && (
            <span className="text-green-500">
              {bimElements.length} authored
            </span>
          )}
        </div>
      )}
      {activeTab === "markups" && markups.length > 0 && (
        <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-slate-500 flex items-center justify-between">
          <span>
            {markups.filter((m) => m.status === "open").length} open /{" "}
            {markups.length} total
          </span>
          <span className="text-slate-600">
            {markups.filter((m) => m.linkedBimGuid).length} linked
          </span>
        </div>
      )}
    </aside>
  );
}

function countNodes(nodes: SpatialNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countNodes(node.children);
  }
  return count;
}
