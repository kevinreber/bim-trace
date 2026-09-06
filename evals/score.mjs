#!/usr/bin/env node
/**
 * Eval scorer — replays captured responses through the Tier 1 consistency
 * checks and, where the manifest supplies expectations, the Tier 2 count and
 * dimension comparison. Reads only from disk, so it costs nothing to re-run.
 *
 *   npm run eval:score                 # newest run
 *   npm run eval:score -- --run <id>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHECK_IDS, runChecks } from "./checks.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = path.join(HERE, "runs");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

if (!fs.existsSync(RUNS)) {
  console.error("No runs yet. Capture one with: npm run eval:run");
  process.exit(1);
}

const available = fs.readdirSync(RUNS).filter((d) =>
  fs.statSync(path.join(RUNS, d)).isDirectory(),
).sort();
const runId = arg("run", available[available.length - 1]);
if (!runId || !fs.existsSync(path.join(RUNS, runId))) {
  console.error(`No such run: ${runId}. Available: ${available.join(", ") || "(none)"}`);
  process.exit(1);
}
const runDir = path.join(RUNS, runId);

const manifest = JSON.parse(
  fs.readFileSync(path.join(HERE, "fixtures", "manifest.json"), "utf8"),
);
const fixtures = new Map(manifest.fixtures.map((f) => [f.id, f]));

/** Mirrors the tolerant parsing in aiFloorPlanService so scoring matches the app. */
function parseElements(text) {
  let body = (text ?? "").trim();
  if (body.startsWith("```")) {
    body = body.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    const match = body.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.elements)) return parsed.elements;
  return null;
}

/** Mirrors salvageTruncatedElements in aiFloorPlanService so scores match the app. */
function salvage(text) {
  const start = (text ?? "").indexOf("[");
  if (start === -1) return null;
  let depth = 0, inString = false, escaped = false, lastComplete = -1;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (escaped) escaped = false;
    else if (ch === "\\") escaped = true;
    else if (ch === '"') inString = !inString;
    else if (!inString) {
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) lastComplete = i;
        if (depth < 0) break;
      }
    }
  }
  if (lastComplete === -1) return null;
  try {
    const out = JSON.parse(`${text.slice(start, lastComplete + 1)}]`);
    return Array.isArray(out) && out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function scoreExpectations(expect, stats) {
  if (!expect) return [];
  const out = [];
  const compare = (label, actual, wanted) => {
    if (wanted === undefined || wanted === null) return;
    out.push({ label, actual, wanted, pass: actual === wanted });
  };
  compare("floors", stats.levels, expect.floors);
  compare("doors", stats.doors, expect.doors);
  compare("windows", stats.windows, expect.windows);

  // Adversarial fixtures assert an upper bound instead of an exact count: the
  // right answer is "almost nothing", not a specific number of elements.
  if (typeof expect.maxElements === "number") {
    out.push({
      label: "element count",
      actual: stats.elements,
      wanted: `<= ${expect.maxElements}`,
      pass: stats.elements <= expect.maxElements,
    });
  }

  if (Array.isArray(expect.footprintMeters) && stats.footprint) {
    const within = expect.footprintMeters.every((wanted, i) => {
      const actual = stats.footprint[i];
      return Math.abs(actual - wanted) / wanted <= 0.25;
    });
    out.push({
      label: "footprint",
      actual: stats.footprint.join("x"),
      wanted: `${expect.footprintMeters.join("x")} +/-25%`,
      pass: within,
    });
  }
  return out;
}

const files = fs.readdirSync(runDir).filter((f) => f.endsWith(".json") && f !== "meta.json");
const results = [];
const checkTally = new Map(CHECK_IDS.map((id) => [id, { pass: 0, fail: 0 }]));
let unparseable = 0;
let requestFailures = 0;

for (const file of files.sort()) {
  const record = JSON.parse(fs.readFileSync(path.join(runDir, file), "utf8"));
  if (!record.ok) {
    requestFailures++;
    results.push({ ...record, status: "request-failed" });
    continue;
  }
  const elements = parseElements(record.text) ?? salvage(record.text);
  if (!elements) {
    unparseable++;
    results.push({ ...record, status: "unparseable" });
    continue;
  }
  const fixture = fixtures.get(record.fixtureId);
  // Adversarial fixtures list structural checks under `skipChecks`: near-empty
  // output is the correct answer there, so "no roof" is not a defect.
  const skip = new Set(fixture?.skipChecks ?? []);
  const all = runChecks(elements);
  const stats = all.stats;
  const checks = all.checks.filter((c) => !skip.has(c.id));
  const informational = all.checks.filter((c) => skip.has(c.id) && !c.pass);
  for (const c of checks) {
    const tally = checkTally.get(c.id);
    if (tally) tally[c.pass ? "pass" : "fail"]++;
  }
  results.push({
    ...record,
    text: undefined,
    status: "scored",
    stats,
    checks,
    informational,
    expectations: scoreExpectations(fixture?.expect, stats),
  });
}

const scored = results.filter((r) => r.status === "scored");

console.log(`\nrun ${runId} — ${files.length} responses (${scored.length} scored, ${unparseable} unparseable, ${requestFailures} request failures)\n`);

for (const r of scored) {
  const failed = r.checks.filter((c) => !c.pass);
  const expectFails = r.expectations.filter((e) => !e.pass);
  const verdict = failed.length === 0 && expectFails.length === 0 ? "PASS" : "FAIL";
  console.log(`${verdict}  ${r.fixtureId} run ${r.run}  (${r.stats.elements} elements, ${r.stats.walls}w ${r.stats.doors}d ${r.stats.windows}win, ${r.stats.levels} levels)`);
  for (const c of failed) {
    console.log(`        ${c.id}: ${c.failed}/${c.total} — ${c.detail}`);
  }
  for (const e of expectFails) {
    console.log(`        expected ${e.label} ${e.wanted}, got ${e.actual}`);
  }
  for (const c of r.informational ?? []) {
    console.log(`        (not scored) ${c.id}: ${c.detail}`);
  }
}

console.log("\nCheck failure rate across all scored responses:");
const width = Math.max(...CHECK_IDS.map((id) => id.length));
for (const id of CHECK_IDS) {
  const { pass, fail } = checkTally.get(id);
  const total = pass + fail;
  if (total === 0) continue;
  const rate = ((fail / total) * 100).toFixed(0);
  const bar = "#".repeat(Math.round((fail / total) * 20)).padEnd(20, ".");
  console.log(`  ${id.padEnd(width)}  ${bar}  ${rate}% (${fail}/${total})`);
}

const summaryPath = path.join(runDir, "summary.json");
fs.writeFileSync(summaryPath, JSON.stringify({ runId, results, checkTally: Object.fromEntries(checkTally) }, null, 2));
console.log(`\nwrote ${summaryPath}`);
