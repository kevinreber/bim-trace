import type { SelectedElement } from "@/types";

interface PropertyPanelProps {
  element: SelectedElement | null;
}

export default function PropertyPanel({ element }: PropertyPanelProps) {
  if (!element) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-slate-500 text-sm">No element selected</p>
        <p className="text-slate-600 text-xs mt-1">
          Click an element in the 3D viewer
        </p>
      </div>
    );
  }

  const entries = Object.entries(element.properties);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="bg-slate-700/40 rounded-lg p-3">
        <p className="text-white font-medium text-sm truncate">
          {element.name}
        </p>
        <p className="text-slate-400 text-xs mt-0.5">{element.type}</p>
        {element.expressID > 0 && (
          <p className="text-slate-500 text-[10px] mt-1 font-mono">
            Express ID: {element.expressID}
          </p>
        )}
      </div>

      {entries.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs text-slate-400 font-medium px-1 mb-1">
            Properties
          </p>
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-slate-700/30 text-xs"
            >
              <span className="text-slate-400 min-w-0 shrink-0 max-w-[45%] truncate">
                {key}
              </span>
              <span className="text-slate-200 min-w-0 truncate ml-auto text-right">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
