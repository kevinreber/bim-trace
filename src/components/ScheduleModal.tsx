import { useState } from "react";
import type { BimElement, BimElementType, ScheduleType } from "@/types";

interface ScheduleModalProps {
  type: ScheduleType;
  bimElements: BimElement[];
  onClose: () => void;
  onBimElementUpdate?: (id: string, updates: Partial<BimElement>) => void;
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

function getParamValue(el: BimElement, key: string): string {
  const p = el.params as Record<string, number | boolean>;
  const val = p[key];
  if (val === undefined) return "-";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return typeof val === "number" ? val.toFixed(2) : String(val);
}

function computeLength(el: BimElement): string {
  const dx = el.end.x - el.start.x;
  const dz = el.end.z - el.start.z;
  return Math.sqrt(dx * dx + dz * dz).toFixed(2);
}

function computeArea(el: BimElement): string {
  return (
    Math.abs(el.end.x - el.start.x) * Math.abs(el.end.z - el.start.z)
  ).toFixed(2);
}

/** Editable cell for schedule grid — click to edit, blur/Enter to save */
function EditableCell({
  value,
  onSave,
  editable = true,
}: {
  value: string;
  onSave?: (val: string) => void;
  editable?: boolean;
}) {
  if (!editable || !onSave) {
    return <td>{value}</td>;
  }
  return (
    <td
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => {
        const newVal = e.currentTarget.textContent?.trim() ?? "";
        if (newVal !== value) onSave(newVal);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
      style={{ cursor: "text" }}
    >
      {value}
    </td>
  );
}

/** Which column keys represent editable param fields */
const EDITABLE_PARAM_KEYS = new Set([
  "name",
  "width",
  "height",
  "thickness",
  "radius",
  "depth",
  "sillHeight",
  "riserHeight",
  "treadDepth",
  "numRisers",
  "panelWidth",
  "panelHeight",
  "mullionSize",
  "overhang",
  "postSpacing",
  "diameter",
]);

export default function ScheduleModal({
  type,
  bimElements,
  onClose,
  onBimElementUpdate,
}: ScheduleModalProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>("all");

  let filtered =
    type === "all" ? bimElements : bimElements.filter((el) => el.type === type);

  // Filter by level
  if (filterLevel !== "all") {
    const levelNum = Number.parseFloat(filterLevel);
    filtered = filtered.filter((el) => el.level === levelNum);
  }

  const title =
    type === "all"
      ? "All Elements Schedule"
      : `${TYPE_LABELS[type as BimElementType] ?? type} Schedule`;

  // Get unique levels for filter dropdown
  const uniqueLevels = Array.from(new Set(filtered.map((el) => el.level))).sort(
    (a, b) => a - b,
  );

  // Build columns based on schedule type
  const columns: {
    key: string;
    label: string;
    getValue: (el: BimElement) => string;
    editable?: boolean;
  }[] = [
    { key: "name", label: "Name", getValue: (el) => el.name, editable: true },
    {
      key: "type",
      label: "Type",
      getValue: (el) => TYPE_LABELS[el.type] ?? el.type,
    },
    { key: "level", label: "Level (m)", getValue: (el) => el.level.toFixed(2) },
  ];

  if (type === "door" || type === "window") {
    columns.push(
      {
        key: "width",
        label: "Width (m)",
        getValue: (el) => getParamValue(el, "width"),
        editable: true,
      },
      {
        key: "height",
        label: "Height (m)",
        getValue: (el) => getParamValue(el, "height"),
        editable: true,
      },
    );
    if (type === "window") {
      columns.push({
        key: "sillHeight",
        label: "Sill Height (m)",
        getValue: (el) => getParamValue(el, "sillHeight"),
        editable: true,
      });
    }
    columns.push({
      key: "hostWallId",
      label: "Host Wall",
      getValue: (el) => (el.hostWallId ? el.hostWallId.slice(0, 8) : "-"),
    });
  } else if (type === "room") {
    columns.push(
      { key: "area", label: "Area (m\u00B2)", getValue: computeArea },
      {
        key: "perimeter",
        label: "Perimeter (m)",
        getValue: (el) =>
          (
            2 *
            (Math.abs(el.end.x - el.start.x) + Math.abs(el.end.z - el.start.z))
          ).toFixed(2),
      },
      {
        key: "height",
        label: "Height (m)",
        getValue: (el) => getParamValue(el, "height"),
        editable: true,
      },
    );
  } else if (type === "wall") {
    columns.push(
      { key: "length", label: "Length (m)", getValue: computeLength },
      {
        key: "height",
        label: "Height (m)",
        getValue: (el) => getParamValue(el, "height"),
        editable: true,
      },
      {
        key: "thickness",
        label: "Thickness (m)",
        getValue: (el) => getParamValue(el, "thickness"),
        editable: true,
      },
    );
  } else {
    // Generic: show all numeric params
    const allKeys = new Set<string>();
    for (const el of filtered) {
      for (const k of Object.keys(el.params as Record<string, unknown>)) {
        allKeys.add(k);
      }
    }
    for (const k of Array.from(allKeys)) {
      columns.push({
        key: k,
        label: k.replace(/([A-Z])/g, " $1").trim(),
        getValue: (el) => getParamValue(el, k),
        editable: EDITABLE_PARAM_KEYS.has(k),
      });
    }
  }

  const handleCellSave = (el: BimElement, key: string, newVal: string) => {
    if (!onBimElementUpdate) return;
    if (key === "name") {
      onBimElementUpdate(el.id, { name: newVal });
      return;
    }
    // Try to update as a numeric param
    const num = Number.parseFloat(newVal);
    if (Number.isNaN(num) || num <= 0) return;
    const currentParams = { ...(el.params as Record<string, unknown>) };
    currentParams[key] = num;
    onBimElementUpdate(el.id, {
      params: currentParams as BimElement["params"],
    });
  };

  // Sort
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sorted = [...filtered];
  if (sortKey) {
    const col = columns.find((c) => c.key === sortKey);
    if (col) {
      sorted.sort((a, b) => {
        const va = col.getValue(a);
        const vb = col.getValue(b);
        const na = Number.parseFloat(va);
        const nb = Number.parseFloat(vb);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) {
          return sortAsc ? na - nb : nb - na;
        }
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
  }

  const totalCount = sorted.length;

  return (
    <div className="schedule-overlay" onClick={onClose}>
      <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
        <div className="schedule-header">
          <span>
            {title} ({totalCount} items)
            {onBimElementUpdate && (
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--text-muted)",
                  marginLeft: 8,
                }}
              >
                Click cells to edit
              </span>
            )}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              style={{
                fontSize: "10px",
                padding: "2px 4px",
                background: "var(--revit-input-bg, #2a2a2a)",
                color: "var(--revit-text, #ddd)",
                border: "1px solid var(--revit-border, #444)",
                borderRadius: "2px",
              }}
            >
              <option value="all">All Levels</option>
              {uniqueLevels.map((l) => (
                <option key={l} value={l}>
                  Level {l.toFixed(1)}m
                </option>
              ))}
            </select>
            <button type="button" onClick={onClose} className="ai-modal-close">
              &times;
            </button>
          </div>
        </div>
        <table className="schedule-table">
          <thead>
            <tr>
              <th>#</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{ cursor: "pointer", userSelect: "none" }}
                  title={`Sort by ${col.label}`}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 4, fontSize: "8px" }}>
                      {sortAsc ? "▲" : "▼"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  style={{
                    textAlign: "center",
                    padding: 20,
                    color: "var(--text-muted)",
                  }}
                >
                  No elements found
                </td>
              </tr>
            ) : (
              sorted.map((el, idx) => (
                <tr key={el.id}>
                  <td>{idx + 1}</td>
                  {columns.map((col) => (
                    <EditableCell
                      key={col.key}
                      value={col.getValue(el)}
                      editable={col.editable}
                      onSave={
                        onBimElementUpdate && col.editable
                          ? (val) => handleCellSave(el, col.key, val)
                          : undefined
                      }
                    />
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
