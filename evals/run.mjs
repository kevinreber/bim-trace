#!/usr/bin/env node
/**
 * Eval runner — sends every fixture through the real /api/generate-floor-plan
 * endpoint and writes the raw model responses to disk.
 *
 * Requires `npm run dev` to be running (the endpoint lives in the Vite plugin),
 * so this exercises the shipping path: real prompt, real schema, real proxy.
 *
 * API calls are the expensive part and scoring is free, so the two are kept
 * separate: capture once with this script, then re-score the same responses
 * with `npm run eval:score` as often as you like.
 *
 *   npm run eval:run -- --runs 3 --model claude-opus-5
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { costOf, formatUsd } from "./pricing.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures");
const RUNS = path.join(HERE, "runs");

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const runsPerFixture = Number(arg("runs", "3"));
const model = arg("model", "claude-opus-5");
const baseUrl = arg("base-url", "http://localhost:5173");
const only = arg("fixture", null);

const manifestPath = path.join(FIXTURES, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`No manifest at ${manifestPath}. See evals/README.md.`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const fixtures = manifest.fixtures.filter((f) => !only || f.id === only);

if (fixtures.length === 0) {
  console.error("No fixtures to run. Add images and entries to the manifest.");
  process.exit(1);
}

/** Returns null when any of the fixture's images are missing, so the run can skip it. */
function loadImages(fixture) {
  const images = [];
  for (const name of fixture.images) {
    const file = path.join(FIXTURES, name);
    if (!fs.existsSync(file)) return null;
    const ext = path.extname(name).toLowerCase();
    const mediaType = MIME[ext];
    if (!mediaType) throw new Error(`Unsupported image type: ${name}`);
    images.push({ imageBase64: fs.readFileSync(file).toString("base64"), mediaType });
  }
  return images;
}

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(RUNS, runId);
fs.mkdirSync(outDir, { recursive: true });

// Worst case per request: input is small (system prompt + images), output is
// capped by MAX_TOKENS, and at effort "high" generations reliably run near that
// ceiling. Estimating from the cap keeps the number honest rather than hopeful.
const WORST_CASE_PER_REQUEST = { "claude-opus-5": 0.85, "claude-sonnet-5": 0.5 };
const requests = fixtures.length * runsPerFixture;
const estimate = (WORST_CASE_PER_REQUEST[model] ?? 0.85) * requests;

console.log(`run ${runId} — ${fixtures.length} fixtures x ${runsPerFixture} runs on ${model}`);
console.log(
  `${requests} requests, up to about ${formatUsd(estimate)} at this model's ceiling.`,
);
console.log(
  `Cheaper options: --model claude-sonnet-5, fewer --runs, or --fixture <id> for one.\n`,
);

let failures = 0;
let skipped = 0;
let spent = 0;
for (const fixture of fixtures) {
  const images = loadImages(fixture);
  if (!images) {
    skipped++;
    console.log(`  ${fixture.id} — skipped (images not present)`);
    continue;
  }
  for (let n = 1; n <= runsPerFixture; n++) {
    const started = Date.now();
    let record;
    try {
      const res = await fetch(`${baseUrl}/api/generate-floor-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: process.env.ANTHROPIC_API_KEY,
          images,
          scaleHint: fixture.scaleHint ?? undefined,
          model,
        }),
      });
      const json = await res.json();
      record = res.ok
        ? { ok: true, text: json.text, stopReason: json.stopReason, usage: json.usage }
        : { ok: false, error: json.error ?? `HTTP ${res.status}` };
    } catch (err) {
      record = { ok: false, error: err.message };
    }
    record = {
      fixtureId: fixture.id,
      run: n,
      model,
      ms: Date.now() - started,
      ...record,
    };
    if (!record.ok) failures++;
    // Re-assert the directory before every write. A run costs real money and
    // tens of minutes; losing all of it because the output directory vanished
    // mid-run (a stray cleanup, a synced folder) is not a worthwhile failure mode.
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, `${fixture.id}.${n}.json`),
      JSON.stringify(record, null, 2),
    );
    const cost = costOf(model, record.usage);
    if (cost != null) spent += cost;
    const status = record.ok
      ? `ok (${Math.round(record.ms / 1000)}s, ${record.usage?.output_tokens ?? "?"} out, ${formatUsd(cost)})`
      : `FAILED: ${record.error}`;
    console.log(`  ${fixture.id} run ${n} — ${status}`);
  }
}

fs.writeFileSync(
  path.join(outDir, "meta.json"),
  JSON.stringify({ runId, model, runsPerFixture, baseUrl, fixtures: fixtures.map((f) => f.id) }, null, 2),
);

console.log(`\nwrote ${outDir}`);
console.log(`spent this run: ${formatUsd(spent)}`);
if (skipped > 0) console.log(`${skipped} fixture(s) skipped for missing images`);
if (failures > 0) console.log(`${failures} request(s) failed`);
console.log(`score with: npm run eval:score -- --run ${runId}`);
