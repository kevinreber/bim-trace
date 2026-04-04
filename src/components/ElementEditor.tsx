import { useState } from "react";
import type { BimElement, BimElementType, BimMaterialType } from "@/types";
import { DEFAULT_ELEMENT_MATERIAL } from "@/types";

/* ------------------------------------------------------------------ */
/*  Revit-style Property Grid for authored BIM elements                */
/* ------------------------------------------------------------------ */

interface ElementEditorProps {
  element: BimElement;
  onUpdate: (id: string, updates: Partial<BimElement>) => void;
  onDelete: (id: string) => void;
}

const TYPE_LABELS: Record<BimElementType, string> = {
  wall: "Wall",
  column: "Column",
  slab: "Floor",
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
  room: "Room",
};

const MATERIAL_LABELS: Record<BimMaterialType, string> = {
  concrete: "Concrete",
  wood: "Wood",
  steel: "Steel",
  glass: "Glass",
  brick: "Brick",
  stone: "Stone",
  drywall: "Drywall",
  aluminum: "Aluminum",
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
  room: [
    { key: "height", label: "Height", unit: "m", min: 1, max: 20, step: 0.1 },
  ],
};

export default function ElementEditor({
  element,
  onUpdate,
  onDelete,
}: ElementEditorProps) {
  const fields = PARAM_FIELDS[element.type];
  const params = element.params as Record<string, number>;
  const [expandedSections, setExpandedSections] = useState({
    identity: true,
    dimensions: true,
    material: true,
    constraints: true,
    location: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="prop-grid animate-fade-in">
      {/* Type selector area (like Revit's type selector at top of Properties) */}
      <div className="properties-type-selector">
        <span className="properties-type-badge">
          {TYPE_LABELS[element.type]}
        </span>
        <button
          type="button"
          onClick={() => onDelete(element.id)}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors"
          style={{ color: "#ef4444" }}
          title="Delete element"
        >
          <svg
            viewBox="0 0 16 16"
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 4 L13 4 M5 4 L5 2 L11 2 L11 4 M4 4 L4 14 L12 14 L12 4" />
            <line x1="7" y1="7" x2="7" y2="11" />
            <line x1="9" y1="7" x2="9" y2="11" />
          </svg>
          Delete
        </button>
      </div>

      {/* Identity Data section */}
      <div className="prop-section">
        <button
          type="button"
          className="prop-section-header"
          onClick={() => toggleSection("identity")}
        >
          <span className="text-[8px]">
            {expandedSections.identity ? "▼" : "▶"}
          </span>
          Identity Data
        </button>
        {expandedSections.identity && (
          <>
            <div className="prop-row">
              <span className="prop-label">Name</span>
              <div className="prop-value">
                <input
                  type="text"
                  value={element.name}
                  onChange={(e) =>
                    onUpdate(element.id, { name: e.target.value })
                  }
                  className="prop-input"
                />
              </div>
            </div>
            <div className="prop-row">
              <span className="prop-label">Type</span>
              <div className="prop-value">
                <span
                  className="prop-input"
                  style={{ background: "none", color: "var(--text-muted)" }}
                >
                  {TYPE_LABELS[element.type]}
                </span>
              </div>
            </div>
            <div className="prop-row">
              <span className="prop-label">ID</span>
              <div className="prop-value">
                <span
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {element.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dimensions section */}
      <div className="prop-section">
        <button
          type="button"
          className="prop-section-header"
          onClick={() => toggleSection("dimensions")}
        >
          <span className="text-[8px]">
            {expandedSections.dimensions ? "▼" : "▶"}
          </span>
          Dimensions
        </button>
        {expandedSections.dimensions &&
          fields.map((field) => (
            <div key={field.key} className="prop-row">
              <span className="prop-label">{field.label}</span>
              <div className="prop-value flex items-center">
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
                  className="prop-input"
                />
                <span className="prop-unit">{field.unit}</span>
              </div>
            </div>
          ))}
      </div>

      {/* Material section */}
      <div className="prop-section">
        <button
          type="button"
          className="prop-section-header"
          onClick={() => toggleSection("material")}
        >
          <span className="text-[8px]">
            {expandedSections.material ? "▼" : "▶"}
          </span>
          Material
        </button>
        {expandedSections.material && (
          <div className="prop-row">
            <span className="prop-label">Material</span>
            <div className="prop-value">
              <select
                value={
                  element.material ?? DEFAULT_ELEMENT_MATERIAL[element.type]
                }
                onChange={(e) =>
                  onUpdate(element.id, {
                    material: e.target.value as BimMaterialType,
                  })
                }
                className="prop-input"
              >
                {(Object.keys(MATERIAL_LABELS) as BimMaterialType[]).map(
                  (key) => (
                    <option key={key} value={key}>
                      {MATERIAL_LABELS[key]}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Constraints section */}
      <div className="prop-section">
        <button
          type="button"
          className="prop-section-header"
          onClick={() => toggleSection("constraints")}
        >
          <span className="text-[8px]">
            {expandedSections.constraints ? "▼" : "▶"}
          </span>
          Constraints
        </button>
        {expandedSections.constraints && (
          <div className="prop-row">
            <span className="prop-label">Base Level</span>
            <div className="prop-value flex items-center">
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
                className="prop-input"
              />
              <span className="prop-unit">m</span>
            </div>
          </div>
        )}
      </div>

      {/* Computed metrics for rooms */}
      {element.type === "room" && (
        <div className="prop-section">
          <div className="prop-section-header" style={{ cursor: "default" }}>
            <span className="text-[8px]">▼</span>
            Computed
          </div>
          <div className="prop-row">
            <span className="prop-label">Area</span>
            <div className="prop-value">
              <span
                className="prop-input"
                style={{
                  background: "none",
                  color: "var(--accent-blue)",
                  textAlign: "right",
                  display: "block",
                }}
              >
                {(
                  Math.abs(element.end.x - element.start.x) *
                  Math.abs(element.end.z - element.start.z)
                ).toFixed(2)}
              </span>
            </div>
            <span className="prop-unit">m²</span>
          </div>
          <div className="prop-row">
            <span className="prop-label">Perimeter</span>
            <div className="prop-value">
              <span
                className="prop-input"
                style={{
                  background: "none",
                  color: "var(--accent-blue)",
                  textAlign: "right",
                  display: "block",
                }}
              >
                {(
                  2 *
                  (Math.abs(element.end.x - element.start.x) +
                    Math.abs(element.end.z - element.start.z))
                ).toFixed(2)}
              </span>
            </div>
            <span className="prop-unit">m</span>
          </div>
          <div className="prop-row">
            <span className="prop-label">Volume</span>
            <div className="prop-value">
              <span
                className="prop-input"
                style={{
                  background: "none",
                  color: "var(--accent-blue)",
                  textAlign: "right",
                  display: "block",
                }}
              >
                {(
                  Math.abs(element.end.x - element.start.x) *
                  Math.abs(element.end.z - element.start.z) *
                  (params.height ?? 3)
                ).toFixed(2)}
              </span>
            </div>
            <span className="prop-unit">m³</span>
          </div>
        </div>
      )}

      {/* Location section (read-only, like Revit) */}
      <div className="prop-section">
        <button
          type="button"
          className="prop-section-header"
          onClick={() => toggleSection("location")}
        >
          <span className="text-[8px]">
            {expandedSections.location ? "\u25BC" : "\u25B6"}
          </span>
          Location
        </button>
        {expandedSections.location && (
          <>
            <div className="prop-row">
              <span className="prop-label">Start X</span>
              <div className="prop-value">
                <span
                  className="prop-input"
                  style={{
                    background: "none",
                    color: "var(--text-muted)",
                    textAlign: "right",
                    display: "block",
                  }}
                >
                  {element.start.x.toFixed(2)}
                </span>
              </div>
              <span className="prop-unit">m</span>
            </div>
            <div className="prop-row">
              <span className="prop-label">Start Z</span>
              <div className="prop-value">
                <span
                  className="prop-input"
                  style={{
                    background: "none",
                    color: "var(--text-muted)",
                    textAlign: "right",
                    display: "block",
                  }}
                >
                  {element.start.z.toFixed(2)}
                </span>
              </div>
              <span className="prop-unit">m</span>
            </div>
            <div className="prop-row">
              <span className="prop-label">End X</span>
              <div className="prop-value">
                <span
                  className="prop-input"
                  style={{
                    background: "none",
                    color: "var(--text-muted)",
                    textAlign: "right",
                    display: "block",
                  }}
                >
                  {element.end.x.toFixed(2)}
                </span>
              </div>
              <span className="prop-unit">m</span>
            </div>
            <div className="prop-row">
              <span className="prop-label">End Z</span>
              <div className="prop-value">
                <span
                  className="prop-input"
                  style={{
                    background: "none",
                    color: "var(--text-muted)",
                    textAlign: "right",
                    display: "block",
                  }}
                >
                  {element.end.z.toFixed(2)}
                </span>
              </div>
              <span className="prop-unit">m</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
