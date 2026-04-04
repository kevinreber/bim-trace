import type { BimElement, BimElementType, ScheduleType } from "@/types";

interface ScheduleModalProps {
  type: ScheduleType;
  bimElements: BimElement[];
  onClose: () => void;
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

export default function ScheduleModal({
  type,
  bimElements,
  onClose,
}: ScheduleModalProps) {
  const filtered =
    type === "all" ? bimElements : bimElements.filter((el) => el.type === type);

  const title =
    type === "all"
      ? "All Elements Schedule"
      : `${TYPE_LABELS[type as BimElementType] ?? type} Schedule`;

  // Build columns based on schedule type
  const columns: {
    key: string;
    label: string;
    getValue: (el: BimElement) => string;
  }[] = [
    { key: "name", label: "Name", getValue: (el) => el.name },
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
      },
      {
        key: "height",
        label: "Height (m)",
        getValue: (el) => getParamValue(el, "height"),
      },
    );
    if (type === "window") {
      columns.push({
        key: "sillHeight",
        label: "Sill Height (m)",
        getValue: (el) => getParamValue(el, "sillHeight"),
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
      },
    );
  } else if (type === "wall") {
    columns.push(
      { key: "length", label: "Length (m)", getValue: computeLength },
      {
        key: "height",
        label: "Height (m)",
        getValue: (el) => getParamValue(el, "height"),
      },
      {
        key: "thickness",
        label: "Thickness (m)",
        getValue: (el) => getParamValue(el, "thickness"),
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
      });
    }
  }

  // Summary row
  const totalCount = filtered.length;

  return (
    <div className="schedule-overlay" onClick={onClose}>
      <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
        <div className="schedule-header">
          <span>
            {title} ({totalCount} items)
          </span>
          <button type="button" onClick={onClose} className="ai-modal-close">
            &times;
          </button>
        </div>
        <table className="schedule-table">
          <thead>
            <tr>
              <th>#</th>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
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
              filtered.map((el, idx) => (
                <tr key={el.id}>
                  <td>{idx + 1}</td>
                  {columns.map((col) => (
                    <td key={col.key}>{col.getValue(el)}</td>
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
