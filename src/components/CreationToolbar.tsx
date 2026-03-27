import type { CreationTool } from "@/types";

interface CreationToolbarProps {
  activeTool: CreationTool;
  onToolChange: (tool: CreationTool) => void;
}

interface ToolDef {
  id: CreationTool;
  label: string;
  icon: string;
}

const STRUCTURAL_TOOLS: ToolDef[] = [
  { id: "wall", label: "Wall", icon: "W" },
  { id: "column", label: "Column", icon: "C" },
  { id: "slab", label: "Slab", icon: "S" },
  { id: "beam", label: "Beam", icon: "B" },
  { id: "ceiling", label: "Ceiling", icon: "G" },
  { id: "roof", label: "Roof", icon: "R" },
  { id: "stair", label: "Stair", icon: "A" },
  { id: "railing", label: "Railing", icon: "I" },
  { id: "curtainWall", label: "Curtain Wall", icon: "K" },
];

const OPENING_TOOLS: ToolDef[] = [
  { id: "door", label: "Door", icon: "D" },
  { id: "window", label: "Window", icon: "N" },
];

const FURNITURE_TOOLS: ToolDef[] = [
  { id: "table", label: "Table", icon: "T" },
  { id: "chair", label: "Chair", icon: "H" },
  { id: "shelving", label: "Shelving", icon: "L" },
];

function ToolGroup({
  label,
  tools,
  activeTool,
  onToolChange,
}: {
  label: string;
  tools: ToolDef[];
  activeTool: CreationTool;
  onToolChange: (tool: CreationTool) => void;
}) {
  return (
    <>
      <span className="text-[9px] text-slate-500 uppercase tracking-wider mx-1">
        {label}
      </span>
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => onToolChange(tool.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
            activeTool === tool.id
              ? "bg-green-600 text-white"
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
    </>
  );
}

export default function CreationToolbar({
  activeTool,
  onToolChange,
}: CreationToolbarProps) {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 backdrop-blur-sm shadow-lg">
      {/* Select tool */}
      <button
        type="button"
        onClick={() => onToolChange("none")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
          activeTool === "none"
            ? "bg-slate-600 text-white"
            : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
        }`}
        title="Select"
      >
        <span className="font-mono text-[10px] font-bold w-3 text-center">
          V
        </span>
        <span>Select</span>
      </button>

      <div className="w-px h-5 bg-slate-600 mx-1" />
      <ToolGroup
        label="Structure"
        tools={STRUCTURAL_TOOLS}
        activeTool={activeTool}
        onToolChange={onToolChange}
      />

      <div className="w-px h-5 bg-slate-600 mx-1" />
      <ToolGroup
        label="Openings"
        tools={OPENING_TOOLS}
        activeTool={activeTool}
        onToolChange={onToolChange}
      />

      <div className="w-px h-5 bg-slate-600 mx-1" />
      <ToolGroup
        label="Furniture"
        tools={FURNITURE_TOOLS}
        activeTool={activeTool}
        onToolChange={onToolChange}
      />
    </div>
  );
}
