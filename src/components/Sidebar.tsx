import { useState } from "react";
import type { Markup, SelectedElement, SpatialNode } from "@/types";
import MarkupList from "./MarkupList";
import PropertyPanel from "./PropertyPanel";

interface SidebarProps {
  tree: SpatialNode[];
  selectedElement: SelectedElement | null;
  markups: Markup[];
  onMarkupStatusChange: (id: string, status: Markup["status"]) => void;
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
          {node.children.map((child) => (
            <TreeNode key={child.expressID} node={child} depth={depth + 1} />
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
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("tree");

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
          (tree.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-slate-500 text-sm">No model loaded</p>
              <p className="text-slate-600 text-xs mt-1">
                Drop an .ifc file onto the 3D viewer
              </p>
            </div>
          ) : (
            <div className="py-1">
              {tree.map((node) => (
                <TreeNode key={node.expressID} node={node} depth={0} />
              ))}
            </div>
          ))}

        {activeTab === "properties" && (
          <PropertyPanel element={selectedElement} />
        )}

        {activeTab === "markups" && (
          <MarkupList markups={markups} onStatusChange={onMarkupStatusChange} />
        )}
      </div>

      {/* Footer */}
      {activeTab === "tree" && tree.length > 0 && (
        <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-slate-500">
          {countNodes(tree)} elements
        </div>
      )}
      {activeTab === "markups" && markups.length > 0 && (
        <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-slate-500">
          {markups.filter((m) => m.status === "open").length} open /{" "}
          {markups.length} total
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
