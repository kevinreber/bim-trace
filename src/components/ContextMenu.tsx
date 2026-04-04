import { useEffect, useRef } from "react";
import type { BimElement } from "@/types";

interface ContextMenuProps {
  x: number;
  y: number;
  elementId: string | null;
  bimElements: BimElement[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onCopy: (id: string) => void;
  onSelect: (id: string) => void;
  onHideCategory: (type: string) => void;
  onSelectAll: (type: string) => void;
}

export default function ContextMenu({
  x,
  y,
  elementId,
  bimElements,
  onClose,
  onDelete,
  onCopy,
  onSelect,
  onHideCategory,
  onSelectAll,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const element = elementId
    ? bimElements.find((el) => el.id === elementId)
    : null;

  return (
    <div ref={ref} className="context-menu" style={{ left: x, top: y }}>
      {element ? (
        <>
          <div
            style={{
              padding: "4px 14px",
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {element.name}
          </div>
          <div className="context-menu-separator" />
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              onSelect(element.id);
              onClose();
            }}
          >
            <svg
              viewBox="0 0 16 16"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path d="M3 3 L3 13 L8 9 L12 14" />
            </svg>
            Select
          </button>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              onCopy(element.id);
              onClose();
            }}
          >
            <svg
              viewBox="0 0 16 16"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <rect x="5" y="5" width="8" height="8" rx="1" />
              <path d="M3 11 L3 3 Q3 2 4 2 L12 2" />
            </svg>
            Copy
            <span className="context-menu-shortcut">Ctrl+C</span>
          </button>
          <div className="context-menu-separator" />
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              onSelectAll(element.type);
              onClose();
            }}
          >
            <svg
              viewBox="0 0 16 16"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <rect x="2" y="2" width="5" height="5" rx="0.5" />
              <rect x="9" y="2" width="5" height="5" rx="0.5" />
              <rect x="2" y="9" width="5" height="5" rx="0.5" />
              <rect x="9" y="9" width="5" height="5" rx="0.5" />
            </svg>
            Select All {element.type}s
          </button>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              onHideCategory(element.type);
              onClose();
            }}
          >
            <svg
              viewBox="0 0 16 16"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path d="M1 8 Q8 2 15 8 Q8 14 1 8" />
              <line x1="2" y1="2" x2="14" y2="14" />
            </svg>
            Hide Category ({element.type})
          </button>
          <div className="context-menu-separator" />
          <button
            type="button"
            className="context-menu-item danger"
            onClick={() => {
              onDelete(element.id);
              onClose();
            }}
          >
            <svg
              viewBox="0 0 16 16"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path d="M3 4 L13 4 M5 4 L5 2 L11 2 L11 4 M4 4 L4 14 L12 14 L12 4" />
            </svg>
            Delete
            <span className="context-menu-shortcut">Del</span>
          </button>
        </>
      ) : (
        <>
          <div
            style={{
              padding: "6px 14px",
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            No element selected
          </div>
        </>
      )}
    </div>
  );
}
