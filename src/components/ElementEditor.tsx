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
  window: "Window",
  beam: "Beam",
  ceiling: "Ceiling",
  roof: "Roof",
  stair: "Stair",
  railing: "Railing",
  curtainWall: "Curtain Wall",
  table: "Table",
  chair: "Chair",
  shelving: "Shelving",
  desk: "Desk",
  toilet: "Toilet",
  sink: "Sink",
  duct: "Duct",
  pipe: "Pipe",
  lightFixture: "Light Fixture",
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
  window: [
    { key: "height", label: "Height", unit: "m", min: 0.3, max: 3, step: 0.1 },
    { key: "width", label: "Width", unit: "m", min: 0.3, max: 4, step: 0.1 },
    {
      key: "sillHeight",
      label: "Sill Height",
      unit: "m",
      min: 0,
      max: 3,
      step: 0.1,
    },
  ],
  beam: [
    { key: "height", label: "Height", unit: "m", min: 0.1, max: 2, step: 0.05 },
    { key: "width", label: "Width", unit: "m", min: 0.1, max: 1, step: 0.05 },
  ],
  ceiling: [
    {
      key: "thickness",
      label: "Thickness",
      unit: "m",
      min: 0.05,
      max: 1,
      step: 0.01,
    },
  ],
  roof: [
    {
      key: "height",
      label: "Ridge Height",
      unit: "m",
      min: 0.5,
      max: 10,
      step: 0.1,
    },
    {
      key: "thickness",
      label: "Thickness",
      unit: "m",
      min: 0.05,
      max: 1,
      step: 0.01,
    },
    {
      key: "overhang",
      label: "Overhang",
      unit: "m",
      min: 0,
      max: 2,
      step: 0.05,
    },
  ],
  stair: [
    {
      key: "riserHeight",
      label: "Riser Height",
      unit: "m",
      min: 0.1,
      max: 0.3,
      step: 0.01,
    },
    {
      key: "treadDepth",
      label: "Tread Depth",
      unit: "m",
      min: 0.2,
      max: 0.5,
      step: 0.01,
    },
    { key: "width", label: "Width", unit: "m", min: 0.5, max: 3, step: 0.1 },
    { key: "numRisers", label: "Risers", unit: "#", min: 2, max: 30, step: 1 },
  ],
  railing: [
    { key: "height", label: "Height", unit: "m", min: 0.5, max: 2, step: 0.05 },
    {
      key: "postSpacing",
      label: "Post Spacing",
      unit: "m",
      min: 0.3,
      max: 3,
      step: 0.1,
    },
  ],
  curtainWall: [
    { key: "height", label: "Height", unit: "m", min: 1, max: 20, step: 0.1 },
    {
      key: "panelWidth",
      label: "Panel Width",
      unit: "m",
      min: 0.3,
      max: 3,
      step: 0.1,
    },
    {
      key: "panelHeight",
      label: "Panel Height",
      unit: "m",
      min: 0.3,
      max: 5,
      step: 0.1,
    },
    {
      key: "mullionSize",
      label: "Mullion Size",
      unit: "m",
      min: 0.02,
      max: 0.2,
      step: 0.01,
    },
  ],
  table: [
    {
      key: "height",
      label: "Height",
      unit: "m",
      min: 0.3,
      max: 1.5,
      step: 0.05,
    },
    { key: "width", label: "Width", unit: "m", min: 0.5, max: 3, step: 0.1 },
    { key: "depth", label: "Depth", unit: "m", min: 0.3, max: 2, step: 0.1 },
  ],
  chair: [
    {
      key: "height",
      label: "Height",
      unit: "m",
      min: 0.5,
      max: 1.5,
      step: 0.05,
    },
    { key: "width", label: "Width", unit: "m", min: 0.3, max: 1, step: 0.05 },
    { key: "depth", label: "Depth", unit: "m", min: 0.3, max: 1, step: 0.05 },
  ],
  shelving: [
    { key: "height", label: "Height", unit: "m", min: 0.5, max: 3, step: 0.1 },
    { key: "width", label: "Width", unit: "m", min: 0.3, max: 3, step: 0.1 },
    { key: "depth", label: "Depth", unit: "m", min: 0.2, max: 1, step: 0.05 },
  ],
  desk: [
    {
      key: "height",
      label: "Height",
      unit: "m",
      min: 0.3,
      max: 1.5,
      step: 0.05,
    },
    { key: "width", label: "Width", unit: "m", min: 0.5, max: 3, step: 0.1 },
    { key: "depth", label: "Depth", unit: "m", min: 0.3, max: 2, step: 0.1 },
  ],
  toilet: [
    {
      key: "height",
      label: "Height",
      unit: "m",
      min: 0.3,
      max: 0.6,
      step: 0.01,
    },
    { key: "width", label: "Width", unit: "m", min: 0.3, max: 0.5, step: 0.01 },
    { key: "depth", label: "Depth", unit: "m", min: 0.5, max: 0.9, step: 0.01 },
  ],
  sink: [
    {
      key: "height",
      label: "Height",
      unit: "m",
      min: 0.7,
      max: 1.0,
      step: 0.01,
    },
    { key: "width", label: "Width", unit: "m", min: 0.3, max: 0.8, step: 0.01 },
    { key: "depth", label: "Depth", unit: "m", min: 0.3, max: 0.6, step: 0.01 },
  ],
  duct: [
    { key: "height", label: "Height", unit: "m", min: 0.1, max: 1, step: 0.05 },
    { key: "width", label: "Width", unit: "m", min: 0.1, max: 1, step: 0.05 },
  ],
  pipe: [
    {
      key: "diameter",
      label: "Diameter",
      unit: "m",
      min: 0.02,
      max: 0.5,
      step: 0.01,
    },
  ],
  lightFixture: [
    { key: "width", label: "Width", unit: "m", min: 0.2, max: 2, step: 0.1 },
    { key: "depth", label: "Depth", unit: "m", min: 0.2, max: 2, step: 0.1 },
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
