import type { AnnotationTool } from "@/types";

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  hasPdf: boolean;
}

type ToolEntry = { id: AnnotationTool; label: string; icon: string };

const DRAWING_TOOLS: ToolEntry[] = [
  { id: "cloud", label: "Cloud", icon: "C" },
  { id: "arrow", label: "Arrow", icon: "A" },
  { id: "callout", label: "Callout", icon: "N" },
  { id: "text", label: "Text", icon: "T" },
];

const SHAPE_TOOLS: ToolEntry[] = [
  { id: "freehand", label: "Freehand", icon: "F" },
  { id: "rectangle", label: "Rectangle", icon: "R" },
  { id: "circle", label: "Circle", icon: "O" },
  { id: "polyline", label: "Polyline", icon: "P" },
  { id: "highlight", label: "Highlight", icon: "H" },
];

const MEASURE_TOOLS: ToolEntry[] = [
  { id: "measurement", label: "Measure", icon: "M" },
];

function ToolGroup({
  label,
  tools,
  activeTool,
  onToolChange,
}: {
  label: string;
  tools: ToolEntry[];
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-slate-500 uppercase tracking-wider mr-1">
        {label}
      </span>
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => onToolChange(tool.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
            activeTool === tool.id
              ? "bg-blue-600 text-white"
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

function Divider() {
  return <div className="w-px h-5 bg-slate-600 mx-1.5" />;
}

export default function AnnotationToolbar({
  activeTool,
  onToolChange,
  hasPdf,
}: AnnotationToolbarProps) {
  if (!hasPdf) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-900/80 border-b border-slate-700 shrink-0">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-2">
        Tools
      </span>
      <button
        type="button"
        onClick={() => onToolChange("select")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
          activeTool === "select"
            ? "bg-blue-600 text-white"
            : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
        }`}
        title="Select"
      >
        <span className="font-mono text-[10px] font-bold w-3 text-center">
          V
        </span>
        <span>Select</span>
      </button>
      <Divider />
      <ToolGroup
        label="Draw"
        tools={DRAWING_TOOLS}
        activeTool={activeTool}
        onToolChange={onToolChange}
      />
      <Divider />
      <ToolGroup
        label="Shapes"
        tools={SHAPE_TOOLS}
        activeTool={activeTool}
        onToolChange={onToolChange}
      />
      <Divider />
      <ToolGroup
        label="Measure"
        tools={MEASURE_TOOLS}
        activeTool={activeTool}
        onToolChange={onToolChange}
      />
    </div>
  );
}
