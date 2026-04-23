import type { Keynote } from "@/types";

interface KeynoteLegendProps {
  keynotes: Keynote[];
  onClose: () => void;
}

export default function KeynoteLegend({
  keynotes,
  onClose,
}: KeynoteLegendProps) {
  // Group by category
  const categories = new Map<string, Keynote[]>();
  for (const kn of keynotes) {
    const list = categories.get(kn.category) || [];
    list.push(kn);
    categories.set(kn.category, list);
  }

  return (
    <div className="schedule-overlay" onClick={onClose}>
      <div
        className="schedule-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "500px" }}
      >
        <div className="schedule-header">
          <span>Keynote Legend</span>
          <button type="button" onClick={onClose} className="ai-modal-close">
            &times;
          </button>
        </div>
        <div style={{ padding: 12, maxHeight: "60vh", overflowY: "auto" }}>
          {Array.from(categories.entries()).map(([cat, kns]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--accent-blue, #3b82f6)",
                  marginBottom: 4,
                  borderBottom: "1px solid var(--revit-border, #444)",
                  paddingBottom: 2,
                }}
              >
                {cat}
              </div>
              {kns.map((kn) => (
                <div
                  key={kn.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "3px 0",
                    fontSize: 11,
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color: "#fbbf24",
                      minWidth: 40,
                    }}
                  >
                    {kn.key}
                  </span>
                  <span style={{ color: "#ccc" }}>{kn.text}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
