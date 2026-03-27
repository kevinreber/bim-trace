import type { Markup, SelectedElement } from "@/types";

interface MarkupListProps {
  markups: Markup[];
  onStatusChange: (id: string, status: Markup["status"]) => void;
  onNavigate: (markup: Markup) => void;
  onLink: (markupId: string) => void;
  selectedElement: SelectedElement | null;
  /** When set, only show markups linked to this globalId */
  filterByGuid?: string;
}

const STATUS_COLORS: Record<Markup["status"], string> = {
  open: "bg-red-500/20 text-red-400",
  pending: "bg-yellow-500/20 text-yellow-400",
  resolved: "bg-green-500/20 text-green-400",
};

const TYPE_ICONS: Record<Markup["type"], string> = {
  cloud: "C",
  arrow: "A",
  callout: "N",
  text: "T",
};

export default function MarkupList({
  markups,
  onStatusChange,
  onNavigate,
  onLink,
  selectedElement,
  filterByGuid,
}: MarkupListProps) {
  const filtered = filterByGuid
    ? markups.filter((m) => m.linkedBimGuid === filterByGuid)
    : markups;

  if (markups.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-slate-500 text-sm">No markups yet</p>
        <p className="text-slate-600 text-xs mt-1">
          Use annotation tools on a PDF to create markups
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-slate-500 text-sm">
          No markups linked to this element
        </p>
        <p className="text-slate-600 text-xs mt-1">
          Select a markup and click the link button to connect it
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {filtered.map((markup) => {
        const isLinked = !!markup.linkedBimGuid;
        const canLink = !!selectedElement;

        return (
          <div
            key={markup.id}
            className="flex flex-col gap-1.5 p-2 rounded-lg hover:bg-slate-700/30 transition-colors group"
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded bg-slate-700 text-[10px] font-mono font-bold text-slate-400">
                {TYPE_ICONS[markup.type]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 truncate">
                    {markup.type.charAt(0).toUpperCase() + markup.type.slice(1)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    p.{markup.pageNumber}
                  </span>
                </div>
                {markup.comment && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {markup.comment}
                  </p>
                )}
              </div>
              <select
                value={markup.status}
                onChange={(e) =>
                  onStatusChange(markup.id, e.target.value as Markup["status"])
                }
                className={`text-[10px] px-1.5 py-0.5 rounded border-0 cursor-pointer font-medium ${STATUS_COLORS[markup.status]}`}
                style={{ backgroundColor: "rgb(30 41 59)" }}
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {/* Trace Engine: link indicator + actions */}
            <div className="flex items-center gap-1.5 ml-8">
              {isLinked ? (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate(markup)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
                    title="Fly to linked 3D element"
                  >
                    <span className="font-mono">3D</span>
                    <span className="truncate max-w-[100px]">
                      {markup.linkedElementName || markup.linkedBimGuid}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onLink(markup.id)}
                    className="px-1.5 py-0.5 rounded text-[10px] text-red-400/70 hover:bg-red-500/15 hover:text-red-400 transition-colors"
                    title="Unlink from 3D element"
                  >
                    Unlink
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onLink(markup.id)}
                  disabled={!canLink}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                    canLink
                      ? "text-slate-400 hover:bg-slate-600/30 hover:text-slate-300"
                      : "text-slate-600 cursor-not-allowed"
                  }`}
                  title={
                    canLink
                      ? `Link to ${selectedElement.name}`
                      : "Select a 3D element first"
                  }
                >
                  Link to 3D
                  {canLink && (
                    <span className="truncate max-w-[80px] text-slate-500">
                      ({selectedElement.name})
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
