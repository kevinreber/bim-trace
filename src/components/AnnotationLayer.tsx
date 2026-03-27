import * as fabric from "fabric";
import { useCallback, useEffect, useRef } from "react";
import type { AnnotationTool, Markup, SelectedElement } from "@/types";

interface AnnotationLayerProps {
  activeTool: AnnotationTool;
  pdfCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onMarkupCreated: (markup: Omit<Markup, "id" | "createdAt">) => void;
  currentPage: number;
  /** When a 3D element is selected, new markups auto-link to it */
  selectedElement: SelectedElement | null;
}

export default function AnnotationLayer({
  activeTool,
  pdfCanvasRef,
  onMarkupCreated,
  currentPage,
  selectedElement,
}: AnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const selectedElementRef = useRef(selectedElement);
  selectedElementRef.current = selectedElement;

  // Sync Fabric canvas size with PDF canvas
  useEffect(() => {
    const pdfCanvas = pdfCanvasRef.current;
    const canvas = canvasRef.current;
    if (!pdfCanvas || !canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      canvas.width = pdfCanvas.width;
      canvas.height = pdfCanvas.height;
      canvas.style.width = `${pdfCanvas.offsetWidth}px`;
      canvas.style.height = `${pdfCanvas.offsetHeight}px`;
      if (fabricRef.current) {
        fabricRef.current.setDimensions({
          width: pdfCanvas.offsetWidth,
          height: pdfCanvas.offsetHeight,
        });
      }
    });

    resizeObserver.observe(pdfCanvas);
    return () => resizeObserver.disconnect();
  }, [pdfCanvasRef]);

  // Initialize Fabric.js canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fc = new fabric.Canvas(canvas, {
      selection: true,
      preserveObjectStacking: true,
    });
    fabricRef.current = fc;

    // Size to match PDF canvas
    const pdfCanvas = pdfCanvasRef.current;
    if (pdfCanvas) {
      fc.setDimensions({
        width: pdfCanvas.offsetWidth,
        height: pdfCanvas.offsetHeight,
      });
    }

    return () => {
      fc.dispose();
      fabricRef.current = null;
    };
  }, [pdfCanvasRef]);

  // Update cursor based on active tool
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    if (activeTool === "select") {
      fc.defaultCursor = "default";
      fc.selection = true;
      fc.forEachObject((o) => {
        o.selectable = true;
      });
    } else {
      fc.defaultCursor = "crosshair";
      fc.selection = false;
      fc.forEachObject((o) => {
        o.selectable = false;
      });
    }
  }, [activeTool]);

  const createAnnotation = useCallback(
    (pointer: { x: number; y: number }) => {
      const fc = fabricRef.current;
      if (!fc) return;

      const tool = activeToolRef.current;
      if (tool === "select") return;

      let obj: fabric.FabricObject | null = null;
      let markupType: Markup["type"] = "cloud";

      switch (tool) {
        case "cloud": {
          obj = new fabric.Rect({
            left: pointer.x - 60,
            top: pointer.y - 30,
            width: 120,
            height: 60,
            fill: "rgba(239, 68, 68, 0.15)",
            stroke: "#ef4444",
            strokeWidth: 2,
            strokeDashArray: [8, 4],
            rx: 12,
            ry: 12,
          });
          markupType = "cloud";
          break;
        }
        case "arrow": {
          const points: [number, number, number, number] = [
            pointer.x - 40,
            pointer.y,
            pointer.x + 40,
            pointer.y,
          ];
          obj = new fabric.Line(points, {
            stroke: "#f59e0b",
            strokeWidth: 3,
          });
          // Add arrowhead
          const arrowHead = new fabric.Triangle({
            left: pointer.x + 40,
            top: pointer.y - 8,
            width: 16,
            height: 16,
            fill: "#f59e0b",
            angle: 90,
            selectable: false,
          });
          fc.add(arrowHead);
          markupType = "arrow";
          break;
        }
        case "callout": {
          obj = new fabric.Rect({
            left: pointer.x - 80,
            top: pointer.y - 20,
            width: 160,
            height: 40,
            fill: "rgba(59, 130, 246, 0.15)",
            stroke: "#3b82f6",
            strokeWidth: 2,
            rx: 4,
            ry: 4,
          });
          const label = new fabric.Textbox("Add note...", {
            left: pointer.x - 70,
            top: pointer.y - 12,
            width: 140,
            fontSize: 13,
            fill: "#93c5fd",
            fontFamily: "sans-serif",
            editable: true,
          });
          fc.add(label);
          markupType = "callout";
          break;
        }
        case "text": {
          obj = new fabric.Textbox("Text", {
            left: pointer.x - 30,
            top: pointer.y - 10,
            width: 120,
            fontSize: 14,
            fill: "#e2e8f0",
            fontFamily: "sans-serif",
            editable: true,
          });
          markupType = "text";
          break;
        }
      }

      if (obj) {
        fc.add(obj);
        fc.setActiveObject(obj);
        fc.renderAll();

        // Auto-link to currently selected 3D element
        const el = selectedElementRef.current;
        onMarkupCreated({
          pageNumber: currentPage,
          type: markupType,
          coords: { x: pointer.x, y: pointer.y },
          comment: "",
          status: "open",
          linkedBimGuid: el?.globalId,
          linkedElementName: el?.name,
        });
      }
    },
    [onMarkupCreated, currentPage],
  );

  // Handle mouse down on canvas
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    const handler = (opt: fabric.TPointerEventInfo) => {
      if (activeToolRef.current === "select") return;
      // Only create annotation if clicking on empty canvas (not on an object)
      if (!opt.target) {
        createAnnotation(fc.getViewportPoint(opt.e));
      }
    };

    fc.on("mouse:down", handler);
    return () => {
      fc.off("mouse:down", handler);
    };
  }, [createAnnotation]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10"
      style={{ pointerEvents: activeTool === "select" ? "none" : "auto" }}
    />
  );
}
