import type { BimElement, BimElementType } from "@/types";

interface ElementEditorProps {
  element: BimElement;
  onUpdate: (id: string, updates: Partial<BimElement>) => void;
  onDelete: (id: string) => void;
}

const TYPE_LABELS: Record<BimElementType, string> = {
  wall: "Wall",
  column: "Column",
  slab: "Slab",
  door: "Door",
};

interface ParamField {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const PARAM_FIELDS: Record<BimElementType, ParamField[]> = {
  wall: [
    { key: "height", label: "Height", unit: "m", min: 0.5, max: 20, step: 0.1 },
    {
      key: "thickness",
      label: "Thickness",
      unit: "m",
      min: 0.05,
      max: 1,
      step: 0.01,
    },
  ],
  column: [
    { key: "height", label: "Height", unit: "m", min: 0.5, max: 20, step: 0.1 },
    {
      key: "radius",
      label: "Radius",
      unit: "m",
      min: 0.05,
      max: 1,
      step: 0.01,
    },
  ],
  slab: [
    {
      key: "thickness",
      label: "Thickness",
      unit: "m",
      min: 0.05,
      max: 2,
      step: 0.01,
    },
  ],
  door: [
    { key: "height", label: "Height", unit: "m", min: 1, max: 4, step: 0.1 },
    { key: "width", label: "Width", unit: "m", min: 0.5, max: 3, step: 0.1 },
  ],
};

export default function ElementEditor({
  element,
  onUpdate,
  onDelete,
}: ElementEditorProps) {
  const fields = PARAM_FIELDS[element.type];
  const params = element.params as Record<string, number>;

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="bg-green-900/30 border border-green-800/40 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm">{element.name}</p>
            <p className="text-green-400 text-xs mt-0.5">
              {TYPE_LABELS[element.type]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDelete(element.id)}
            className="px-2 py-1 rounded text-[10px] text-red-400 hover:bg-red-500/15 transition-colors"
            title="Delete element"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-xs text-slate-400 font-medium px-1">
          Name
          <input
            type="text"
            value={element.name}
            onChange={(e) => onUpdate(element.id, { name: e.target.value })}
            className="mt-1 block w-full px-2 py-1.5 rounded bg-slate-700/50 border border-slate-600 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </label>
      </div>

      {/* Parameters */}
      <div className="space-y-2">
        <p className="text-xs text-slate-400 font-medium px-1">Parameters</p>
        {fields.map((field) => (
          <div key={field.key} className="flex items-center gap-2 px-1">
            <span className="text-xs text-slate-400 w-20 shrink-0">
              {field.label}
            </span>
            <input
              type="number"
              value={params[field.key]}
              min={field.min}
              max={field.max}
              step={field.step}
              onChange={(e) => {
                const val = Number.parseFloat(e.target.value);
                if (Number.isNaN(val)) return;
                onUpdate(element.id, {
                  params: { ...element.params, [field.key]: val },
                });
              }}
              className="flex-1 px-2 py-1 rounded bg-slate-700/50 border border-slate-600 text-sm text-white text-right focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[10px] text-slate-500 w-5">{field.unit}</span>
          </div>
        ))}
      </div>

      {/* Level */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-slate-400 w-20 shrink-0">Level</span>
        <input
          type="number"
          value={element.level}
          min={0}
          max={100}
          step={0.1}
          onChange={(e) => {
            const val = Number.parseFloat(e.target.value);
            if (Number.isNaN(val)) return;
            onUpdate(element.id, { level: val });
          }}
          className="flex-1 px-2 py-1 rounded bg-slate-700/50 border border-slate-600 text-sm text-white text-right focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-[10px] text-slate-500 w-5">m</span>
      </div>

      {/* Position info (read-only) */}
      <div className="space-y-1 mt-1">
        <p className="text-xs text-slate-400 font-medium px-1">Position</p>
        <div className="grid grid-cols-2 gap-1 px-1 text-[10px]">
          <span className="text-slate-500">
            Start: ({element.start.x.toFixed(1)}, {element.start.z.toFixed(1)})
          </span>
          <span className="text-slate-500">
            End: ({element.end.x.toFixed(1)}, {element.end.z.toFixed(1)})
          </span>
        </div>
      </div>
    </div>
  );
}
