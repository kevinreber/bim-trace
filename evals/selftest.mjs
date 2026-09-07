#!/usr/bin/env node
/**
 * Self-test for the eval checks.
 *
 * Builds one clean building and one with a deliberately planted defect per
 * check, then asserts each check fires exactly where expected. Guards the
 * checks themselves — a check that silently stops firing would otherwise make
 * every future eval run look healthier than it is.
 *
 *   npm run eval:selftest
 */
import { runChecks } from "./checks.mjs";

const wall = (i, sx, sz, ex, ez, level = 0) => ({
  id: `wall-${i}`, type: "wall", name: `Wall ${i}`,
  start: { x: sx, z: sz }, end: { x: ex, z: ez },
  params: { height: 3, thickness: 0.3 }, level, rotation: null, hostWallId: null,
});

const opening = (type, i, x, z, host, width = 0.9, level = 0) => ({
  id: `${type}-${i}`, type, name: `${type} ${i}`,
  start: { x, z }, end: { x, z },
  params: type === "door"
    ? { height: 2.1, width }
    : { height: 1.2, width, sillHeight: 0.9 },
  level, rotation: 0, hostWallId: host,
});

const slab = (level = 0) => ({
  id: `slab-${level}`, type: "slab", name: "Slab",
  start: { x: -5, z: -4 }, end: { x: 5, z: 4 },
  params: { thickness: 0.25 }, level, rotation: null, hostWallId: null,
});

const roof = () => ({
  id: "roof-1", type: "roof", name: "Roof",
  start: { x: -5.3, z: -4.3 }, end: { x: 5.3, z: 4.3 },
  params: { height: 3, thickness: 0.2, overhang: 0.3 }, level: 0,
  rotation: null, hostWallId: null,
});

const CLEAN = [
  wall(1, -5, -4, 5, -4), wall(2, 5, -4, 5, 4),
  wall(3, 5, 4, -5, 4), wall(4, -5, 4, -5, -4),
  // Interior partition forming a T-junction against the north and south walls.
  // Real floor plans are full of these and they must not read as open ends.
  wall(5, 0, -4, 0, 4),
  opening("door", 1, -2, -4, "wall-1"),
  opening("window", 1, 5, 0, "wall-2", 1.0),
  slab(), roof(),
];

const BROKEN = [
  wall(1, 0, 0, 6, 0), wall(2, 6, 0, 6, 5),
  // A third ground wall so the footprint walk has something to attempt: these
  // three form an open U that encloses nothing, which is what
  // footprint_traceable exists to catch.
  wall(3, 6, 5, 3, 5),
  // A wall on an upper storey, so the building is genuinely multi-storey and
  // the stair check is exercised. Storeys are counted from walls, so a fixture
  // whose only upper-level element is an opening would not trigger it.
  wall(3, 0, 0, 6, 0, 3),
  opening("door", 1, 3, 0, "wall-does-not-exist"),
  opening("window", 1, 3, 2, "wall-1", 1.0),
  opening("door", 2, 7, 0, "wall-1"),
  opening("window", 2, 6, 2, "wall-2", 2.0),
  opening("window", 3, 6, 2.5, "wall-2", 2.0),
  opening("door", 3, 6, 1, "wall-2", 0.9, 3),
];

const EXPECTED_TO_FAIL = [
  "host_resolution", "host_level_match", "opening_on_wall",
  "opening_within_span", "opening_no_overlap", "wall_loop_closure",
  "level_has_slab", "multistory_has_stair", "has_roof",
  "footprint_traceable",
];

const problems = [];

const cleanResult = runChecks(CLEAN);
for (const c of cleanResult.checks) {
  if (!c.pass) problems.push(`clean building unexpectedly failed ${c.id}: ${c.detail}`);
}
if (cleanResult.stats.walls !== 5 || cleanResult.stats.levels !== 1) {
  problems.push(`clean stats wrong: ${JSON.stringify(cleanResult.stats)}`);
}
// The clean fixture is a 10x8 rectangle with one interior partition, so the
// outline walk must find four corners and fill its bounding box. Asserting the
// numbers rather than only "did not fail" is what makes the shape stats
// trustworthy — a walk that silently returned null would pass the checks.
if (cleanResult.stats.footprintCorners !== 4) {
  problems.push(`clean footprint should have 4 corners, got ${cleanResult.stats.footprintCorners}`);
}
if (cleanResult.stats.footprintFill !== 1) {
  problems.push(`clean footprint should fill its bounding box, got ${cleanResult.stats.footprintFill}`);
}

// An L-shaped outline must read as articulated, or the metric cannot tell a
// rectangle from a plan the model was supposed to reproduce faithfully.
const L_SHAPED = [
  wall(1, 0, 0, 6, 0), wall(2, 6, 0, 6, 3), wall(3, 6, 3, 3, 3),
  wall(4, 3, 3, 3, 6), wall(5, 3, 6, 0, 6), wall(6, 0, 6, 0, 0),
];
const lResult = runChecks(L_SHAPED);
if (lResult.stats.footprintCorners !== 6) {
  problems.push(`L-shape should have 6 corners, got ${lResult.stats.footprintCorners}`);
}
if (!(lResult.stats.footprintFill < 0.9)) {
  problems.push(`L-shape should not fill its bounding box, got ${lResult.stats.footprintFill}`);
}

const brokenResult = runChecks(BROKEN);
const failedIds = new Set(brokenResult.checks.filter((c) => !c.pass).map((c) => c.id));
for (const id of EXPECTED_TO_FAIL) {
  if (!failedIds.has(id)) problems.push(`broken building should have failed ${id} but did not`);
}

// Degenerate and non-finite inputs must not throw.
for (const [label, input] of [
  ["empty", []],
  ["zero-length wall", [wall(1, 0, 0, 0, 0)]],
  ["non-finite", [wall(1, 0, 0, Number.NaN, 4)]],
  ["missing fields", [{ id: "x", type: "wall" }]],
]) {
  try {
    runChecks(input);
  } catch (err) {
    problems.push(`runChecks threw on ${label}: ${err.message}`);
  }
}

if (problems.length > 0) {
  console.error("eval selftest FAILED:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`eval selftest passed — ${cleanResult.checks.length} checks verified against clean and broken fixtures`);
