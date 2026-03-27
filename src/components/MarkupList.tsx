import type { Markup } from "@/types";

interface MarkupListProps {
  markups: Markup[];
  onStatusChange: (id: string, status: Markup["status"]) => void;
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
}: MarkupListProps) {
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

  return (
    <div className="flex flex-col gap-1 p-2">
      {markups.map((markup) => (
        <div
          key={markup.id}
          className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-700/30 transition-colors group"
        >
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
      ))}
    </div>
  );
}
