"use client";

import { useState } from "react";
import type { SpatialNode } from "./Viewer3D";

interface SidebarProps {
  tree: SpatialNode[];
}

const TYPE_ICONS: Record<string, string> = {
  IFCSITE: "🌍",
  IFCBUILDING: "🏢",
  IFCBUILDINGSTOREY: "📐",
  IFCSPACE: "🔲",
  IFCWALL: "▬",
  IFCWALLSTANDARDCASE: "▬",
  IFCDOOR: "🚪",
  IFCWINDOW: "◻",
  IFCSLAB: "▭",
  IFCCOLUMN: "┃",
  IFCBEAM: "━",
  IFCSTAIR: "⊞",
  IFCROOF: "⌂",
};

function TreeNode({ node, depth }: { node: SpatialNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const icon = TYPE_ICONS[node.type] || "◈";
  const shortType = node.type.replace("IFC", "");

  return (
    <div>
      <button
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
        <span className="text-xs">{icon}</span>
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
            <TreeNode
              key={child.expressID}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ tree }: SidebarProps) {
  return (
    <aside className="w-80 h-full bg-[var(--sidebar-bg)] border-r border-[var(--border)] flex flex-col">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h1 className="text-base font-bold text-white tracking-tight">
          BIM Trace
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Spatial Tree</p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {tree.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-slate-500 text-sm">No model loaded</p>
            <p className="text-slate-600 text-xs mt-1">
              Drop an .ifc file onto the viewer
            </p>
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode key={node.expressID} node={node} depth={0} />
          ))
        )}
      </div>

      {tree.length > 0 && (
        <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-slate-500">
          {countNodes(tree)} elements
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
