/**
 * Client-side depth estimation using Depth Anything V2 (Small) via ONNX Runtime Web.
 *
 * Produces a grayscale depth map from an input image — darker pixels are closer,
 * lighter pixels are farther. The depth map is returned as a base64-encoded PNG
 * that can be sent alongside the original image to Claude for improved 3D inference.
 *
 * No API keys or servers required — runs entirely in the browser.
 */
import * as ort from "onnxruntime-web";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Input resolution expected by the Depth Anything V2 ViT-S ONNX model. */
const MODEL_INPUT_SIZE = 518;

/**
 * Public CDN path for the Depth Anything V2 Small ONNX model.
 * ~100 MB, cached by the browser after first download.
 */
const MODEL_URL =
  "https://huggingface.co/depth-anything/Depth-Anything-V2-Small/resolve/main/depth_anything_v2_vits.onnx";

/** ImageNet normalization mean (RGB). */
const MEAN: [number, number, number] = [0.485, 0.456, 0.406];
/** ImageNet normalization std (RGB). */
const STD: [number, number, number] = [0.229, 0.224, 0.225];

// ---------------------------------------------------------------------------
// Singleton session
// ---------------------------------------------------------------------------

let sessionPromise: Promise<ort.InferenceSession> | null = null;

/** Progress callback for model loading. */
export type DepthModelProgress = (phase: string, detail?: string) => void;

/**
 * Load (or return cached) ONNX inference session.
 * The model is fetched once and the session is reused for subsequent calls.
 */
async function getSession(
  onProgress?: DepthModelProgress,
): Promise<ort.InferenceSession> {
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    onProgress?.(
      "loading",
      "Downloading depth model (~100 MB, cached after first use)...",
    );

    // Prefer WebGPU → WASM fallback
    const session = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["webgpu", "wasm"],
    });

    onProgress?.("ready", "Depth model loaded.");
    return session;
  })();

  // If loading fails, allow retry on next call
  sessionPromise.catch(() => {
    sessionPromise = null;
  });

  return sessionPromise;
}

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

/**
 * Load an image File into an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Resize and normalize an image to a float32 CHW tensor suitable for the model.
 * Returns the tensor and the original image dimensions.
 */
function preprocessImage(img: HTMLImageElement): {
  tensor: ort.Tensor;
  origWidth: number;
  origHeight: number;
} {
  const canvas = document.createElement("canvas");
  canvas.width = MODEL_INPUT_SIZE;
  canvas.height = MODEL_INPUT_SIZE;
  // biome-ignore lint/style/noNonNullAssertion: canvas 2d context is always available for newly created canvases
  const ctx = canvas.getContext("2d")!;

  // Resize with bilinear interpolation (default canvas behavior)
  ctx.drawImage(img, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

  const imageData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const { data } = imageData;
  const numPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;

  // Convert to float32 CHW with ImageNet normalization
  const float32 = new Float32Array(3 * numPixels);
  for (let i = 0; i < numPixels; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    float32[i] = (r - MEAN[0]) / STD[0]; // R channel
    float32[numPixels + i] = (g - MEAN[1]) / STD[1]; // G channel
    float32[2 * numPixels + i] = (b - MEAN[2]) / STD[2]; // B channel
  }

  const tensor = new ort.Tensor("float32", float32, [
    1,
    3,
    MODEL_INPUT_SIZE,
    MODEL_INPUT_SIZE,
  ]);

  return { tensor, origWidth: img.naturalWidth, origHeight: img.naturalHeight };
}

/**
 * Convert raw model output (relative depth float32 HxW) into a grayscale PNG
 * at the original image resolution. Returns a base64-encoded PNG string.
 */
function depthToBase64Png(
  depthData: Float32Array,
  modelH: number,
  modelW: number,
  origWidth: number,
  origHeight: number,
): string {
  // Normalize depth values to 0-255 range
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < depthData.length; i++) {
    if (depthData[i] < min) min = depthData[i];
    if (depthData[i] > max) max = depthData[i];
  }
  const range = max - min || 1;

  // Render depth map at model resolution first
  const modelCanvas = document.createElement("canvas");
  modelCanvas.width = modelW;
  modelCanvas.height = modelH;
  // biome-ignore lint/style/noNonNullAssertion: canvas 2d context is always available for newly created canvases
  const modelCtx = modelCanvas.getContext("2d")!;
  const modelImageData = modelCtx.createImageData(modelW, modelH);

  for (let i = 0; i < depthData.length; i++) {
    // Invert so that closer = darker, farther = lighter
    const value = 255 - Math.round(((depthData[i] - min) / range) * 255);
    modelImageData.data[i * 4] = value;
    modelImageData.data[i * 4 + 1] = value;
    modelImageData.data[i * 4 + 2] = value;
    modelImageData.data[i * 4 + 3] = 255;
  }
  modelCtx.putImageData(modelImageData, 0, 0);

  // Resize to original image dimensions for 1:1 correspondence
  const outCanvas = document.createElement("canvas");
  outCanvas.width = origWidth;
  outCanvas.height = origHeight;
  // biome-ignore lint/style/noNonNullAssertion: canvas 2d context is always available for newly created canvases
  const outCtx = outCanvas.getContext("2d")!;
  outCtx.drawImage(modelCanvas, 0, 0, origWidth, origHeight);

  // Return base64 PNG (without the data:image/png;base64, prefix)
  return outCanvas.toDataURL("image/png").split(",")[1];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DepthEstimationResult {
  /** Base64-encoded PNG depth map (grayscale, darker = closer). */
  depthMapBase64: string;
  /** Object URL for previewing the depth map in an <img> tag. */
  depthMapPreviewUrl: string;
  /** Original image width. */
  width: number;
  /** Original image height. */
  height: number;
}

/**
 * Estimate depth from a single image file.
 *
 * @param file - The image file to process.
 * @param onProgress - Optional callback for status updates.
 * @returns Depth map as base64 PNG and a preview URL.
 */
export async function estimateDepth(
  file: File,
  onProgress?: DepthModelProgress,
): Promise<DepthEstimationResult> {
  const session = await getSession(onProgress);

  onProgress?.("processing", "Generating depth map...");

  const img = await loadImage(file);
  const { tensor, origWidth, origHeight } = preprocessImage(img);

  // Run inference
  const feeds: Record<string, ort.Tensor> = { image: tensor };
  const results = await session.run(feeds);

  // The model outputs a single tensor with shape [1, H, W] or [1, 1, H, W]
  const outputTensor = Object.values(results)[0];
  const depthData = outputTensor.data as Float32Array;
  const dims = outputTensor.dims;

  // Determine output spatial dimensions
  const modelH = dims.length === 4 ? dims[2] : dims[1];
  const modelW = dims.length === 4 ? dims[3] : dims[2];

  const depthMapBase64 = depthToBase64Png(
    depthData,
    modelH as number,
    modelW as number,
    origWidth,
    origHeight,
  );

  // Create a blob URL for previewing
  const byteString = atob(depthMapBase64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "image/png" });
  const depthMapPreviewUrl = URL.createObjectURL(blob);

  onProgress?.("done", "Depth estimation complete.");

  return {
    depthMapBase64,
    depthMapPreviewUrl,
    width: origWidth,
    height: origHeight,
  };
}

/**
 * Pre-load the depth model so it's ready when the user generates.
 * Safe to call multiple times — only downloads once.
 */
export function preloadDepthModel(onProgress?: DepthModelProgress): void {
  getSession(onProgress).catch(() => {
    // Swallow — will retry on next call
  });
}
