import { useState } from "react";
import type { SavedView, Sheet, SheetViewport } from "@/types";

interface SheetComposerProps {
  sheets: Sheet[];
  onSheetsChange: (sheets: Sheet[]) => void;
  savedViews: SavedView[];
  onClose: () => void;
}

const TITLE_BLOCKS = {
  standard: {
    width: 841, // A1 landscape (mm)
    height: 594,
    borderInset: 10,
  },
  minimal: {
    width: 420, // A3 landscape (mm)
    height: 297,
    borderInset: 5,
  },
};

function TitleBlockSvg({ sheet, scale }: { sheet: Sheet; scale: number }) {
  const tb = TITLE_BLOCKS[sheet.titleBlock];
  const w = tb.width * scale;
  const h = tb.height * scale;
  const inset = tb.borderInset * scale;
  const tbHeight = 30 * scale;

  return (
    <>
      {/* Border */}
      <rect
        x={inset}
        y={inset}
        width={w - inset * 2}
        height={h - inset * 2}
        fill="none"
        stroke="#666"
        strokeWidth={1}
      />
      {/* Title block box (bottom right) */}
      <rect
        x={w - 200 * scale}
        y={h - tbHeight - inset}
        width={200 * scale - inset}
        height={tbHeight}
        fill="none"
        stroke="#666"
        strokeWidth={0.5}
      />
      {/* Sheet number */}
      <text
        x={w - 195 * scale}
        y={h - tbHeight - inset + 12 * scale}
        fontSize={8 * scale}
        fill="#aaa"
      >
        {sheet.number}
      </text>
      {/* Sheet name */}
      <text
        x={w - 195 * scale}
        y={h - tbHeight - inset + 22 * scale}
        fontSize={6 * scale}
        fill="#888"
      >
        {sheet.name}
      </text>
      {/* Project name */}
      <text
        x={w - 100 * scale}
        y={h - tbHeight - inset + 12 * scale}
        fontSize={5 * scale}
        fill="#666"
      >
        BIM Trace Project
      </text>
    </>
  );
}

export default function SheetComposer({
  sheets,
  onSheetsChange,
  savedViews,
  onClose,
}: SheetComposerProps) {
  const [activeSheetId, setActiveSheetId] = useState<string | null>(
    sheets[0]?.id ?? null,
  );

  const activeSheet = sheets.find((s) => s.id === activeSheetId);
  const displayScale = 0.8; // mm to px

  const handleAddSheet = () => {
    const num = `A${(sheets.length + 1).toString().padStart(3, "0")}`;
    const newSheet: Sheet = {
      id: crypto.randomUUID(),
      number: num,
      name: `New Sheet`,
      titleBlock: "standard",
      viewports: [],
    };
    onSheetsChange([...sheets, newSheet]);
    setActiveSheetId(newSheet.id);
  };

  const handleDeleteSheet = (id: string) => {
    const updated = sheets.filter((s) => s.id !== id);
    onSheetsChange(updated);
    if (activeSheetId === id) {
      setActiveSheetId(updated[0]?.id ?? null);
    }
  };

  const handleAddViewport = (viewName: string) => {
    if (!activeSheet) return;
    const vp: SheetViewport = {
      id: crypto.randomUUID(),
      viewName,
      x: 50,
      y: 50,
      width: 300,
      height: 200,
      scale: "1:100",
    };
    const updated = sheets.map((s) =>
      s.id === activeSheet.id ? { ...s, viewports: [...s.viewports, vp] } : s,
    );
    onSheetsChange(updated);
  };

  const handleRemoveViewport = (vpId: string) => {
    if (!activeSheet) return;
    const updated = sheets.map((s) =>
      s.id === activeSheet.id
        ? { ...s, viewports: s.viewports.filter((v) => v.id !== vpId) }
        : s,
    );
    onSheetsChange(updated);
  };

  const handleUpdateSheet = (updates: Partial<Sheet>) => {
    if (!activeSheet) return;
    const updated = sheets.map((s) =>
      s.id === activeSheet.id ? { ...s, ...updates } : s,
    );
    onSheetsChange(updated);
  };

  return (
    <div className="schedule-overlay" onClick={onClose}>
      <div
        className="schedule-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "900px", maxHeight: "80vh" }}
      >
        <div className="schedule-header">
          <span>Sheet Composer</span>
          <button type="button" onClick={onClose} className="ai-modal-close">
            &times;
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            padding: 12,
            height: "calc(80vh - 60px)",
          }}
        >
          {/* Sheet list sidebar */}
          <div
            style={{
              width: 160,
              borderRight: "1px solid var(--revit-border, #444)",
              paddingRight: 8,
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: 10, color: "#999", marginBottom: 4 }}>
              Sheets
            </div>
            {sheets.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveSheetId(s.id)}
                style={{
                  padding: "4px 6px",
                  fontSize: 11,
                  cursor: "pointer",
                  borderRadius: 3,
                  background:
                    s.id === activeSheetId
                      ? "var(--accent-blue, #3b82f6)"
                      : "transparent",
                  color: s.id === activeSheetId ? "#fff" : "#ccc",
                  marginBottom: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  {s.number} - {s.name}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSheet(s.id);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#888",
                    cursor: "pointer",
                    fontSize: 12,
                    padding: 0,
                  }}
                >
                  x
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddSheet}
              style={{
                width: "100%",
                padding: "4px",
                fontSize: 10,
                marginTop: 4,
                background: "var(--revit-input-bg, #2a2a2a)",
                color: "#aaa",
                border: "1px dashed #555",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              + Add Sheet
            </button>
          </div>

          {/* Sheet preview */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {activeSheet ? (
              <>
                {/* Sheet properties */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    fontSize: 10,
                    alignItems: "center",
                  }}
                >
                  <label>
                    Number:
                    <input
                      type="text"
                      value={activeSheet.number}
                      onChange={(e) =>
                        handleUpdateSheet({ number: e.target.value })
                      }
                      style={{
                        width: 60,
                        marginLeft: 4,
                        fontSize: 10,
                        padding: "2px 4px",
                        background: "var(--revit-input-bg, #2a2a2a)",
                        color: "#ddd",
                        border: "1px solid #444",
                        borderRadius: 2,
                      }}
                    />
                  </label>
                  <label>
                    Name:
                    <input
                      type="text"
                      value={activeSheet.name}
                      onChange={(e) =>
                        handleUpdateSheet({ name: e.target.value })
                      }
                      style={{
                        width: 120,
                        marginLeft: 4,
                        fontSize: 10,
                        padding: "2px 4px",
                        background: "var(--revit-input-bg, #2a2a2a)",
                        color: "#ddd",
                        border: "1px solid #444",
                        borderRadius: 2,
                      }}
                    />
                  </label>
                  <label>
                    Title Block:
                    <select
                      value={activeSheet.titleBlock}
                      onChange={(e) =>
                        handleUpdateSheet({
                          titleBlock: e.target.value as "standard" | "minimal",
                        })
                      }
                      style={{
                        marginLeft: 4,
                        fontSize: 10,
                        padding: "2px 4px",
                        background: "var(--revit-input-bg, #2a2a2a)",
                        color: "#ddd",
                        border: "1px solid #444",
                        borderRadius: 2,
                      }}
                    >
                      <option value="standard">A1 Standard</option>
                      <option value="minimal">A3 Minimal</option>
                    </select>
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleAddViewport(e.target.value);
                      e.target.value = "";
                    }}
                    defaultValue=""
                    style={{
                      fontSize: 10,
                      padding: "2px 4px",
                      background: "var(--revit-input-bg, #2a2a2a)",
                      color: "#ddd",
                      border: "1px solid #444",
                      borderRadius: 2,
                    }}
                  >
                    <option value="" disabled>
                      + Add View...
                    </option>
                    <option value="3D View">3D View</option>
                    <option value="Plan View">Plan View</option>
                    <option value="Front Elevation">Front Elevation</option>
                    <option value="Section">Section</option>
                    {savedViews.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sheet canvas */}
                <div
                  style={{
                    flex: 1,
                    background: "#1a1a1a",
                    borderRadius: 4,
                    overflow: "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                  }}
                >
                  <svg
                    width={
                      TITLE_BLOCKS[activeSheet.titleBlock].width * displayScale
                    }
                    height={
                      TITLE_BLOCKS[activeSheet.titleBlock].height * displayScale
                    }
                    style={{ background: "#fff" }}
                  >
                    <TitleBlockSvg sheet={activeSheet} scale={displayScale} />
                    {/* Viewports */}
                    {activeSheet.viewports.map((vp) => (
                      <g key={vp.id}>
                        <rect
                          x={vp.x * displayScale}
                          y={vp.y * displayScale}
                          width={vp.width * displayScale}
                          height={vp.height * displayScale}
                          fill="#f0f0f0"
                          stroke="#333"
                          strokeWidth={0.5}
                          strokeDasharray="4 2"
                        />
                        <text
                          x={(vp.x + 4) * displayScale}
                          y={(vp.y + 12) * displayScale}
                          fontSize={8 * displayScale}
                          fill="#333"
                        >
                          {vp.viewName} ({vp.scale})
                        </text>
                        {/* Remove button */}
                        <text
                          x={(vp.x + vp.width - 10) * displayScale}
                          y={(vp.y + 12) * displayScale}
                          fontSize={8 * displayScale}
                          fill="#c00"
                          style={{ cursor: "pointer" }}
                          onClick={() => handleRemoveViewport(vp.id)}
                        >
                          x
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#666",
                  fontSize: 12,
                }}
              >
                No sheets. Click "+ Add Sheet" to create one.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
