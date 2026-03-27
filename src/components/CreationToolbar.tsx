import type { CreationTool } from "@/types";

interface CreationToolbarProps {
  activeTool: CreationTool;
  onToolChange: (tool: CreationTool) => void;
}

const TOOLS: { id: CreationTool; label: string; icon: string }[] = [
  { id: "none", label: "Select", icon: "V" },
  { id: "wall", label: "Wall", icon: "W" },
  { id: "column", label: "Column", icon: "C" },
  { id: "slab", label: "Slab", icon: "S" },
  { id: "door", label: "Door", icon: "D" },
];

export default function CreationToolbar({
  activeTool,
  onToolChange,
}: CreationToolbarProps) {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 backdrop-blur-sm shadow-lg">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1.5">
        Create
      </span>
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => onToolChange(tool.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
            activeTool === tool.id
              ? tool.id === "none"
                ? "bg-slate-600 text-white"
                : "bg-green-600 text-white"
              : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
          }`}
          title={tool.label}
        >
          <span className="font-mono text-[10px] font-bold w-3 text-center">
            {tool.icon}
          </span>
          <span>{tool.label}</span>
        </button>
      ))}
    </div>
  );
}
