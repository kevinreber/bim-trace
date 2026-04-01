import { useCallback, useRef, useState } from "react";
import { clearApiKey, getApiKey, setApiKey } from "../services/aiApiKeyStore";
import {
  type AiGenerateResult,
  generateFloorPlan,
} from "../services/aiFloorPlanService";
import type { BimElement } from "../types";

interface AiGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (elements: BimElement[]) => void;
}

type ModalState = "idle" | "generating" | "preview" | "error";

export default function AiGenerateModal({
  isOpen,
  onClose,
  onApply,
}: AiGenerateModalProps) {
  const [state, setState] = useState<ModalState>("idle");
  const [apiKey, setApiKeyState] = useState(getApiKey() ?? "");
  const [showKey, setShowKey] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scaleHint, setScaleHint] = useState("");
  const [result, setResult] = useState<AiGenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKeyInputId = "ai-modal-api-key";
  const scaleHintInputId = "ai-modal-scale-hint";

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, or WebP)");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Image must be under 20MB");
      return;
    }
    setImageFile(file);
    setError(null);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const resetModal = useCallback(() => {
    setState("idle");
    setImageFile(null);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setScaleHint("");
    setResult(null);
    setError(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!imageFile) return;

    const key = apiKey.trim();
    if (!key) {
      setError("Please enter your Anthropic API key");
      return;
    }

    setApiKey(key);
    setState("generating");
    setError(null);

    try {
      const res = await generateFloorPlan(
        key,
        imageFile,
        scaleHint.trim() || undefined,
      );
      setResult(res);
      setState("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setState("error");
    }
  }, [imageFile, apiKey, scaleHint]);

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
          <span className="ai-modal-label">Floor Plan Image</span>
          {/* biome-ignore lint/a11y/useSemanticElements: dropzone needs div for drag-and-drop support */}
          <div
            role="button"
            tabIndex={0}
            className={`ai-modal-dropzone ${dragOver ? "drag-over" : ""} ${imagePreview ? "has-image" : ""}`}
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
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Floor plan preview"
                className="ai-modal-preview-img"
              />
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
                <span>Drop image here or click to browse</span>
                <span className="ai-modal-file-hint">
                  PNG, JPG, WebP up to 20MB
                </span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
          {imageFile && (
            <button
              type="button"
              className="ai-modal-btn-sm"
              style={{ marginTop: 6 }}
              onClick={() => {
                setImageFile(null);
                setImagePreview((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
                setState("idle");
                setResult(null);
              }}
            >
              Remove image
            </button>
          )}
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

        {/* Error */}
        {error && <div className="ai-modal-error">{error}</div>}

        {/* Loading */}
        {state === "generating" && (
          <div className="ai-modal-loading">
            <div className="ai-modal-spinner" />
            <span>Analyzing floor plan...</span>
          </div>
        )}

        {/* Preview */}
        {state === "preview" && result && (
          <div className="ai-modal-preview">
            <div className="ai-modal-preview-header">
              Generated {result.elements.length} elements
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
              disabled={!imageFile || state === "generating"}
              onClick={handleGenerate}
            >
              {state === "generating" ? "Generating..." : "Generate"}
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
