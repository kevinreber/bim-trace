import type { AnnotationTool } from "@/types";

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  hasPdf: boolean;
}

const TOOLS: { id: AnnotationTool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "V" },
  { id: "cloud", label: "Cloud", icon: "C" },
  { id: "arrow", label: "Arrow", icon: "A" },
  { id: "callout", label: "Callout", icon: "N" },
  { id: "text", label: "Text", icon: "T" },
];

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
      {TOOLS.map((tool) => (
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
