import * as pdfjsLib from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

interface PdfViewerProps {
  onPageChange: (page: number, totalPages: number) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export default function PdfViewer({ onPageChange, canvasRef }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [isDragging, setIsDragging] = useState(false);
  const [hasPdf, setHasPdf] = useState(false);
  const [loading, setLoading] = useState(false);

  const renderPage = useCallback(
    async (pageNum: number) => {
      const pdf = pdfDocRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas) return;

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      setCurrentPage(pageNum);
      onPageChange(pageNum, totalPages);
    },
    [scale, totalPages, onPageChange, canvasRef],
  );

  const loadPdf = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        pdfDocRef.current = pdf;

        const pages = pdf.numPages;
        setTotalPages(pages);
        setHasPdf(true);

        await renderPage(1);
        onPageChange(1, pages);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        alert("Failed to load PDF file. Check console for details.");
      } finally {
        setLoading(false);
      }
    },
    [renderPage, onPageChange],
  );

  // Re-render on scale change
  useEffect(() => {
    if (hasPdf) {
      renderPage(currentPage);
    }
  }, [hasPdf, currentPage, renderPage]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.name.toLowerCase().endsWith(".pdf")) {
        loadPdf(file);
      }
    },
    [loadPdf],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadPdf(file);
    },
    [loadPdf],
  );

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        renderPage(page);
      }
    },
    [totalPages, renderPage],
  );

  return (
    <section
      ref={containerRef}
      role="application"
      aria-label="PDF viewer"
      className="relative flex-1 h-full flex flex-col bg-slate-800"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      {hasPdf && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border-b border-slate-700 text-xs shrink-0">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300"
          >
            Prev
          </button>
          <span className="text-slate-400">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300"
          >
            Next
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
          >
            -
          </button>
          <span className="text-slate-400 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
          >
            +
          </button>
        </div>
      )}

      {/* Canvas area */}
      <div className="flex-1 overflow-auto relative">
        {isDragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-green-500/20 border-2 border-dashed border-green-400 pointer-events-none">
            <p className="text-green-300 text-xl font-semibold">
              Drop .pdf file here
            </p>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-green-300 text-sm">Loading PDF...</p>
            </div>
          </div>
        )}

        {!hasPdf && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-400 text-lg mb-4">
                Drag & drop a .pdf file here
              </p>
              <label className="cursor-pointer inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm">
                Or browse files
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </div>
          </div>
        )}

        {hasPdf && (
          <div className="flex justify-center p-4">
            <canvas
              ref={canvasRef as React.RefObject<HTMLCanvasElement>}
              className="shadow-2xl"
            />
          </div>
        )}
      </div>
    </section>
  );
}
