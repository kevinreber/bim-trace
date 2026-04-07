import { useCallback, useEffect, useRef, useState } from "react";
import { clearApiKey, getApiKey, setApiKey } from "../services/aiApiKeyStore";
import {
  type AiGenerateResult,
  generateFloorPlan,
} from "../services/aiFloorPlanService";
import {
  type DepthEstimationResult,
  estimateDepth,
  preloadDepthModel,
} from "../services/depthEstimationService";
import type { BimElement } from "../types";

interface AiGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (elements: BimElement[]) => void;
}

type ModalState =
  | "idle"
  | "estimating_depth"
  | "generating"
  | "preview"
  | "error";

export default function AiGenerateModal({
  isOpen,
  onClose,
  onApply,
}: AiGenerateModalProps) {
  const [state, setState] = useState<ModalState>("idle");
  const [apiKey, setApiKeyState] = useState(getApiKey() ?? "");
  const [showKey, setShowKey] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [scaleHint, setScaleHint] = useState("");
  const [result, setResult] = useState<AiGenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [depthResults, setDepthResults] = useState<
    Array<DepthEstimationResult | null>
  >([]);
  const [depthEnabled, setDepthEnabled] = useState(true);
  const [depthProgress, setDepthProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKeyInputId = "ai-modal-api-key";
  const scaleHintInputId = "ai-modal-scale-hint";

  // Preload the depth model when the modal opens
  useEffect(() => {
    if (isOpen && depthEnabled) {
      preloadDepthModel();
    }
  }, [isOpen, depthEnabled]);

  const handleFiles = useCallback((files: File[]) => {
    const valid: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("Please select image files (PNG, JPG, or WebP)");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError("Each image must be under 20MB");
        return;
      }
      valid.push(file);
    }
    setImageFiles((prev) => {
      const combined = [...prev, ...valid].slice(0, 5); // max 5 images
      return combined;
    });
    setError(null);
    const urls = valid.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...urls].slice(0, 5));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles],
  );

  const resetModal = useCallback(() => {
    setState("idle");
    setImageFiles([]);
    setImagePreviews((prev) => {
      for (const url of prev) URL.revokeObjectURL(url);
      return [];
    });
    setDepthResults((prev) => {
      for (const d of prev) {
        if (d) URL.revokeObjectURL(d.depthMapPreviewUrl);
      }
      return [];
    });
    setDepthProgress(null);
    setScaleHint("");
    setResult(null);
    setError(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (imageFiles.length === 0) return;

    const key = apiKey.trim();
    if (!key) {
      setError("Please enter your Anthropic API key");
      return;
    }

    setApiKey(key);
    setError(null);

    let depthMaps: Array<{ base64: string } | null> | undefined;

    // Step 1: Run depth estimation if enabled
    if (depthEnabled) {
      setState("estimating_depth");
      try {
        const results: Array<DepthEstimationResult | null> = [];
        for (const file of imageFiles) {
          try {
            const depthResult = await estimateDepth(file, (phase, detail) => {
              setDepthProgress(detail ?? phase);
            });
            results.push(depthResult);
          } catch {
            // If depth estimation fails for one image, continue without it
            results.push(null);
          }
        }
        setDepthResults(results);
        depthMaps = results.map((r) =>
          r ? { base64: r.depthMapBase64 } : null,
        );
        setDepthProgress(null);
      } catch {
        // If depth estimation fails entirely, continue without it
        setDepthProgress(null);
      }
    }

    // Step 2: Generate BIM elements
    setState("generating");

    try {
      const res = await generateFloorPlan(
        key,
        imageFiles,
        scaleHint.trim() || undefined,
        depthMaps,
      );
      setResult(res);
      setState("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setState("error");
    }
  }, [imageFiles, apiKey, scaleHint, depthEnabled]);

  const handleApply = useCallback(() => {
    if (result) {
      onApply(result.elements);
      resetModal();
    }
  }, [result, onApply, resetModal]);

  const handleClose = useCallback(() => {
    resetModal();
    onClose();
  }, [resetModal, onClose]);

  const handleClearKey = useCallback(() => {
    clearApiKey();
    setApiKeyState("");
  }, []);

  if (!isOpen) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop click-to-close
    <div className="ai-modal-overlay" onMouseDown={handleClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: prevent close on content click */}
      <div
        className="ai-modal-content"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ai-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-blue)"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span>AI Image to BIM</span>
          </div>
          <button
            type="button"
            className="ai-modal-close"
            onClick={handleClose}
          >
            &times;
          </button>
        </div>

        {/* API Key Section */}
        <div className="ai-modal-section">
          <label className="ai-modal-label" htmlFor={apiKeyInputId}>
            Anthropic API Key
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              id={apiKeyInputId}
              type={showKey ? "text" : "password"}
              className="ai-modal-input"
              style={{ flex: 1 }}
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
            />
            <button
              type="button"
              className="ai-modal-btn-sm"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? "Hide" : "Show"}
            </button>
            {apiKey && (
              <button
                type="button"
                className="ai-modal-btn-sm"
                onClick={handleClearKey}
              >
                Clear
              </button>
            )}
          </div>
          <p className="ai-modal-hint">
            Key is stored locally in your browser only.
          </p>
        </div>

        {/* Image Upload */}
        <div className="ai-modal-section">
          <span className="ai-modal-label">
            Building Images{" "}
            <span style={{ fontWeight: "normal", color: "var(--text-muted)" }}>
              (up to 5 — multiple angles improve accuracy)
            </span>
          </span>
          {/* biome-ignore lint/a11y/useSemanticElements: dropzone needs div for drag-and-drop support */}
          <div
            role="button"
            tabIndex={0}
            className={`ai-modal-dropzone ${dragOver ? "drag-over" : ""} ${imagePreviews.length > 0 ? "has-image" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            {imagePreviews.length > 0 ? (
              <div className="ai-modal-image-grid">
                {imagePreviews.map((url, i) => (
                  <div key={url} className="ai-modal-image-thumb">
                    <img
                      src={url}
                      alt={`Building view ${i + 1}`}
                      className="ai-modal-preview-img"
                    />
                    <button
                      type="button"
                      className="ai-modal-image-remove"
                      title="Remove image"
                      onClick={(e) => {
                        e.stopPropagation();
                        URL.revokeObjectURL(url);
                        setImageFiles((prev) =>
                          prev.filter((_, idx) => idx !== i),
                        );
                        setImagePreviews((prev) =>
                          prev.filter((_, idx) => idx !== i),
                        );
                        setDepthResults((prev) => {
                          const removed = prev[i];
                          if (removed)
                            URL.revokeObjectURL(removed.depthMapPreviewUrl);
                          return prev.filter((_, idx) => idx !== i);
                        });
                        setState("idle");
                        setResult(null);
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {imagePreviews.length < 5 && (
                  <div className="ai-modal-image-add">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--text-muted)"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span style={{ fontSize: 10 }}>Add</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="ai-modal-dropzone-text">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span>Drop images here or click to browse</span>
                <span className="ai-modal-file-hint">
                  PNG, JPG, WebP up to 20MB each
                </span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) handleFiles(files);
                // Reset input so same file can be re-selected
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* Scale Hint */}
        <div className="ai-modal-section">
          <label className="ai-modal-label" htmlFor={scaleHintInputId}>
            Scale Hint (optional)
          </label>
          <input
            id={scaleHintInputId}
            type="text"
            className="ai-modal-input"
            placeholder="e.g. The longest wall is approximately 10 meters"
            value={scaleHint}
            onChange={(e) => setScaleHint(e.target.value)}
          />
        </div>

        {/* Depth Estimation Toggle */}
        <div className="ai-modal-section">
          <label className="ai-modal-toggle">
            <input
              type="checkbox"
              checked={depthEnabled}
              onChange={(e) => setDepthEnabled(e.target.checked)}
            />
            <span className="ai-modal-toggle-label">
              Depth estimation
              <span
                style={{ fontWeight: "normal", color: "var(--text-muted)" }}
              >
                {" "}
                — improves 3D accuracy using AI depth analysis
              </span>
            </span>
          </label>
        </div>

        {/* Depth Map Previews */}
        {depthResults.length > 0 && depthResults.some((d) => d != null) && (
          <div className="ai-modal-section">
            <span className="ai-modal-label">Depth Maps</span>
            <div className="ai-modal-image-grid">
              {depthResults.map(
                (d, i) =>
                  d && (
                    <div
                      key={`depth-${imageFiles[i]?.name ?? i}`}
                      className="ai-modal-image-thumb"
                    >
                      <img
                        src={d.depthMapPreviewUrl}
                        alt={`Depth map ${i + 1}`}
                        className="ai-modal-preview-img"
                      />
                    </div>
                  ),
              )}
            </div>
            <p className="ai-modal-hint">
              Darker = closer, lighter = farther. Used to improve 3D dimension
              estimates.
            </p>
          </div>
        )}

        {/* Error */}
        {error && <div className="ai-modal-error">{error}</div>}

        {/* Loading */}
        {state === "estimating_depth" && (
          <div className="ai-modal-loading">
            <div className="ai-modal-spinner" />
            <span>{depthProgress ?? "Estimating depth..."}</span>
          </div>
        )}
        {state === "generating" && (
          <div className="ai-modal-loading">
            <div className="ai-modal-spinner" />
            <span>Analyzing building and generating BIM elements...</span>
          </div>
        )}

        {/* Preview */}
        {state === "preview" && result && (
          <div className="ai-modal-preview">
            <div className="ai-modal-preview-header">
              Generated {result.elements.length} elements
              {result.levelCount > 1 && (
                <span style={{ fontWeight: "normal", marginLeft: 6 }}>
                  across {result.levelCount} levels
                </span>
              )}
            </div>
            <div className="ai-modal-preview-counts">
              {result.wallCount > 0 && (
                <span className="ai-modal-count-badge">
                  {result.wallCount} wall{result.wallCount !== 1 ? "s" : ""}
                </span>
              )}
              {result.doorCount > 0 && (
                <span className="ai-modal-count-badge">
                  {result.doorCount} door{result.doorCount !== 1 ? "s" : ""}
                </span>
              )}
              {result.windowCount > 0 && (
                <span className="ai-modal-count-badge">
                  {result.windowCount} window
                  {result.windowCount !== 1 ? "s" : ""}
                </span>
              )}
              {result.slabCount > 0 && (
                <span className="ai-modal-count-badge">
                  {result.slabCount} slab{result.slabCount !== 1 ? "s" : ""}
                </span>
              )}
              {result.roofCount > 0 && (
                <span className="ai-modal-count-badge">
                  {result.roofCount} roof{result.roofCount !== 1 ? "s" : ""}
                </span>
              )}
              {result.stairCount > 0 && (
                <span className="ai-modal-count-badge">
                  {result.stairCount} stair
                  {result.stairCount !== 1 ? "s" : ""}
                </span>
              )}
              {result.columnCount > 0 && (
                <span className="ai-modal-count-badge">
                  {result.columnCount} column
                  {result.columnCount !== 1 ? "s" : ""}
                </span>
              )}
              {result.beamCount > 0 && (
                <span className="ai-modal-count-badge">
                  {result.beamCount} beam{result.beamCount !== 1 ? "s" : ""}
                </span>
              )}
              {result.ceilingCount > 0 && (
                <span className="ai-modal-count-badge">
                  {result.ceilingCount} ceiling
                  {result.ceilingCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="ai-modal-actions">
          {state === "preview" ? (
            <>
              <button
                type="button"
                className="ai-modal-btn primary"
                onClick={handleApply}
              >
                Apply to Scene
              </button>
              <button
                type="button"
                className="ai-modal-btn"
                onClick={() => {
                  setState("idle");
                  setResult(null);
                }}
              >
                Regenerate
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ai-modal-btn primary"
              disabled={
                imageFiles.length === 0 ||
                state === "generating" ||
                state === "estimating_depth"
              }
              onClick={handleGenerate}
            >
              {state === "estimating_depth"
                ? "Estimating depth..."
                : state === "generating"
                  ? "Generating..."
                  : "Generate"}
            </button>
          )}
          <button type="button" className="ai-modal-btn" onClick={handleClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
