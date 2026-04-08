import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E test for the depth estimation pipeline.
 *
 * Flow:
 *   1. Pre-download the ONNX model (cached locally for subsequent runs)
 *   2. Open the AI Generate modal, upload a synthetic building image
 *   3. Intercept the ONNX model URL to serve from local cache (fast)
 *   4. Trigger depth estimation and wait for the depth map to render
 *   5. Screenshot the depth map and compare to a saved baseline
 *   6. Sample pixel data to verify the near/far depth gradient is correct
 *
 * The synthetic building has known geometry: a front face (closer) and a
 * side wall receding into depth (farther). The test asserts that the depth
 * map reflects this — front wall pixels are darker than side wall pixels.
 */

// Use the quantized model for tests — ~26 MB vs ~100 MB, much faster and less memory in WASM
const MODEL_URL =
  "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_q4.onnx";
const MODEL_CACHE_DIR = path.join(__dirname, ".model-cache");
const MODEL_CACHE_PATH = path.join(MODEL_CACHE_DIR, "model_q4.onnx");

/**
 * Download the ONNX model to a local cache directory if it doesn't exist.
 * This runs once; subsequent test runs use the cached file.
 */
async function ensureModelCached(): Promise<void> {
  if (fs.existsSync(MODEL_CACHE_PATH)) {
    const stat = fs.statSync(MODEL_CACHE_PATH);
    if (stat.size > 1_000_000) return; // sanity: >1MB means it's real
  }

  fs.mkdirSync(MODEL_CACHE_DIR, { recursive: true });
  console.log("Downloading ONNX model to local cache (one-time, ~26 MB)...");

  // Use curl because Node.js fetch may be blocked in some CI environments
  execSync(`curl -L -o "${MODEL_CACHE_PATH}" "${MODEL_URL}"`, {
    stdio: "inherit",
    timeout: 300_000,
  });

  const stat = fs.statSync(MODEL_CACHE_PATH);
  console.log(`Model cached at ${MODEL_CACHE_PATH} (${(stat.size / 1e6).toFixed(1)} MB)`);
}

// Mock Claude API response — a minimal valid building so the modal reaches "preview" state
const MOCK_BIM_RESPONSE = JSON.stringify([
  {
    id: "wall-1",
    type: "wall",
    name: "Test Wall",
    start: { x: -5, z: -5 },
    end: { x: 5, z: -5 },
    params: { height: 3, thickness: 0.3 },
    level: 0,
  },
]);

test.describe("Depth Estimation", () => {
  // Download the model before all tests (5 min timeout for first download)
  test.beforeAll(async () => {
    test.setTimeout(300_000);
    await ensureModelCached();
  });

  test("generates a depth map with correct near/far gradient and matches visual snapshot", async ({
    page,
  }) => {
    // This test needs extra time for ONNX inference via WASM
    test.setTimeout(180_000);

    // ── Intercept the ONNX model URL → serve from local cache ──
    const modelBytes = fs.readFileSync(MODEL_CACHE_PATH);
    await page.route("**/onnx-community/depth-anything-v2-small/**/*.onnx", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/octet-stream",
        body: modelBytes,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=31536000",
        },
      });
    });

    // ── Intercept the Claude API call ──
    await page.route("**/v1/messages", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: MOCK_BIM_RESPONSE }],
          model: "claude-sonnet-4-20250514",
          stop_reason: "end_turn",
          usage: { input_tokens: 0, output_tokens: 0 },
        }),
      });
    });

    // ── Collect browser console for debugging ──
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // ── Step 1: Navigate to the app ──
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // ── Step 2: Generate a synthetic building PNG in-browser ──
    const testImageDataUrl = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      const W = 640;
      const H = 480;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      sky.addColorStop(0, "#87CEEB");
      sky.addColorStop(1, "#B0E0E6");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Ground
      ctx.fillStyle = "#4A7C59";
      ctx.fillRect(0, H * 0.65, W, H * 0.35);

      // Front face (closer to camera)
      ctx.fillStyle = "#C4A882";
      ctx.fillRect(100, 130, 300, 200);

      // Side face receding into depth (farther)
      ctx.fillStyle = "#A08060";
      ctx.beginPath();
      ctx.moveTo(400, 130);
      ctx.lineTo(520, 170);
      ctx.lineTo(520, 330);
      ctx.lineTo(400, 330);
      ctx.closePath();
      ctx.fill();

      // Roof front gable
      ctx.fillStyle = "#8B4513";
      ctx.beginPath();
      ctx.moveTo(80, 130);
      ctx.lineTo(250, 50);
      ctx.lineTo(420, 130);
      ctx.closePath();
      ctx.fill();

      // Roof side slope
      ctx.fillStyle = "#6B3410";
      ctx.beginPath();
      ctx.moveTo(250, 50);
      ctx.lineTo(420, 130);
      ctx.lineTo(530, 170);
      ctx.lineTo(380, 90);
      ctx.closePath();
      ctx.fill();

      // Door
      ctx.fillStyle = "#5C3317";
      ctx.fillRect(210, 230, 50, 100);

      // Windows - front
      ctx.fillStyle = "#ADD8E6";
      ctx.fillRect(130, 170, 50, 40);
      ctx.fillRect(310, 170, 50, 40);

      // Window - side
      ctx.fillStyle = "#90C0D8";
      ctx.beginPath();
      ctx.moveTo(430, 210);
      ctx.lineTo(470, 220);
      ctx.lineTo(470, 260);
      ctx.lineTo(430, 250);
      ctx.closePath();
      ctx.fill();

      return canvas.toDataURL("image/png");
    });

    // ── Step 3: Open the AI Generate modal ──
    const aiButton = page.locator('button:has-text("Image to BIM")');
    await aiButton.first().click();
    await page.waitForSelector(".ai-modal-content", { state: "visible" });

    // ── Step 4: Upload the synthetic image ──
    const base64 = testImageDataUrl.split(",")[1];
    const imageBuffer = Buffer.from(base64, "base64");

    const fileInput = page.locator('.ai-modal-content input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-building.png",
      mimeType: "image/png",
      buffer: imageBuffer,
    });

    await expect(
      page.locator('.ai-modal-image-thumb img[alt="Building view 1"]'),
    ).toBeVisible();

    // ── Step 5: Verify depth toggle is on ──
    const depthToggle = page.locator('.ai-modal-toggle input[type="checkbox"]');
    await expect(depthToggle).toBeChecked();

    // ── Step 6: Enter API key and generate ──
    await page.fill("#ai-modal-api-key", "sk-ant-test-dummy-key-for-e2e");
    await page.click('.ai-modal-btn.primary:has-text("Generate")');

    // ── Step 7: Wait for depth maps to appear ──
    // The depth map section appears after depth estimation completes,
    // before the Claude API call finishes.
    const depthMapsSection = page.locator(
      '.ai-modal-section:has(.ai-modal-label:text("Depth Maps"))',
    );

    // Wait for either depth maps or an error — don't hang forever
    const depthMapImg = page.locator('img[alt="Depth map 1"]');
    const errorDiv = page.locator(".ai-modal-error");

    await Promise.race([
      depthMapImg.waitFor({ state: "visible", timeout: 160_000 }),
      errorDiv
        .waitFor({ state: "visible", timeout: 160_000 })
        .then(async () => {
          const errorText = await errorDiv.textContent();
          // Log browser console errors for debugging
          if (consoleLogs.length > 0) {
            console.log("Browser console errors/warnings:");
            for (const log of consoleLogs) console.log(`  ${log}`);
          }
          throw new Error(`Depth estimation failed with error: ${errorText}`);
        }),
    ]);

    // At this point, depth map is visible
    await expect(depthMapsSection).toBeVisible();
    await expect(depthMapImg).toBeVisible();

    // ── Step 8: Screenshot the depth map for visual regression ──
    await depthMapImg.screenshot({ path: "e2e/depth-map-actual.png" });

    // Visual snapshot comparison — first run creates the baseline,
    // subsequent runs compare against it.
    await expect(depthMapImg).toHaveScreenshot("depth-map-baseline.png", {
      maxDiffPixelRatio: 0.05,
    });

    // ── Step 9: Validate depth map pixel data ──
    const depthAnalysis = await page.evaluate(async () => {
      const depthImg = document.querySelector(
        'img[alt="Depth map 1"]',
      ) as HTMLImageElement;
      if (!depthImg) return null;

      await new Promise<void>((resolve) => {
        if (depthImg.complete) resolve();
        else depthImg.onload = () => resolve();
      });

      const canvas = document.createElement("canvas");
      canvas.width = depthImg.naturalWidth;
      canvas.height = depthImg.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(depthImg, 0, 0);

      const w = canvas.width;
      const h = canvas.height;
      const scaleX = w / 640;
      const scaleY = h / 480;

      function sampleRegion(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
      ): { mean: number; min: number; max: number } {
        const sx1 = Math.round(x1 * scaleX);
        const sy1 = Math.round(y1 * scaleY);
        const sx2 = Math.round(x2 * scaleX);
        const sy2 = Math.round(y2 * scaleY);

        const imageData = ctx.getImageData(sx1, sy1, sx2 - sx1, sy2 - sy1);
        const { data } = imageData;
        let sum = 0;
        let count = 0;
        let min = 255;
        let max = 0;
        for (let i = 0; i < data.length; i += 4) {
          const brightness = data[i];
          sum += brightness;
          count++;
          if (brightness < min) min = brightness;
          if (brightness > max) max = brightness;
        }
        return { mean: sum / count, min, max };
      }

      // Front wall center (should be darker = closer)
      const frontWall = sampleRegion(150, 180, 350, 300);
      // Side wall center (should be lighter = farther)
      const sideWall = sampleRegion(420, 180, 500, 300);
      // Sky (should be lightest = farthest)
      const sky = sampleRegion(10, 10, 90, 80);
      // Ground foreground (should be dark = close)
      const groundNear = sampleRegion(10, 400, 100, 460);

      return { frontWall, sideWall, sky, groundNear, imageWidth: w, imageHeight: h };
    });

    // ── Step 10: Assert depth relationships ──
    expect(depthAnalysis).not.toBeNull();
    const { frontWall, sideWall, sky, groundNear } = depthAnalysis!;

    console.log("Depth analysis results:");
    console.log(`  Front wall mean brightness: ${frontWall.mean.toFixed(1)}`);
    console.log(`  Side wall mean brightness:  ${sideWall.mean.toFixed(1)}`);
    console.log(`  Sky mean brightness:        ${sky.mean.toFixed(1)}`);
    console.log(`  Ground (near) brightness:   ${groundNear.mean.toFixed(1)}`);
    console.log(`  Image dimensions: ${depthAnalysis!.imageWidth}x${depthAnalysis!.imageHeight}`);

    // Core assertion: front wall (closer) should be DARKER than side wall (farther)
    expect(
      frontWall.mean,
      `Front wall (${frontWall.mean.toFixed(1)}) should be darker than side wall (${sideWall.mean.toFixed(1)}) — closer objects should have lower pixel values`,
    ).toBeLessThan(sideWall.mean);

    // Sky should be the lightest (farthest from camera)
    expect(
      sky.mean,
      `Sky (${sky.mean.toFixed(1)}) should be lighter than front wall (${frontWall.mean.toFixed(1)})`,
    ).toBeGreaterThan(frontWall.mean);

    // Depth map should have meaningful variation (not flat/uniform)
    const totalRange =
      Math.max(sky.mean, sideWall.mean, groundNear.mean) -
      Math.min(frontWall.mean, groundNear.mean);
    expect(
      totalRange,
      `Depth map brightness range (${totalRange.toFixed(1)}) should be > 20 — map must not be flat`,
    ).toBeGreaterThan(20);

    // ── Step 11: Verify the full pipeline completed (preview state) ──
    // Wait for the Claude API mock to resolve and show preview
    await expect(
      page.locator('.ai-modal-preview-header:has-text("Generated")'),
    ).toBeVisible({ timeout: 15_000 });
  });
});
