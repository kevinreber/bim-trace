/**
 * Tier 1 consistency checks for generated BIM output.
 *
 * These run against the RAW model output, before `validateAndFixElements`
 * touches it, so they measure the model rather than the validator's repairs.
 * None of them need ground truth — they are internal-consistency invariants.
 */

const EPS = 0.01;
const JOIN_TOL = 0.05; // 50mm: wall endpoints closer than this count as joined

const num = (v, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const of = (elements, type) => elements.filter((e) => e?.type === type);
const openingsOf = (elements) =>
  elements.filter((e) => e?.type === "door" || e?.type === "window");

function wallGeometry(wall) {
  const dx = num(wall.end?.x) - num(wall.start?.x);
  const dz = num(wall.end?.z) - num(wall.start?.z);
  const length = Math.hypot(dx, dz);
  if (length < EPS) return null;
  return {
    length,
    dirX: dx / length,
    dirZ: dz / length,
    thickness: num(wall.params?.thickness, 0.2),
  };
}

/** Signed distance along the wall, and absolute distance off its centerline. */
function projectOnto(wall, geo, point) {
  const hx = num(point?.x) - num(wall.start?.x);
  const hz = num(point?.z) - num(wall.start?.z);
  return {
    along: hx * geo.dirX + hz * geo.dirZ,
    perp: Math.abs(hx * -geo.dirZ + hz * geo.dirX),
  };
}

/** Shortest distance from a point to a wall segment, used to detect T-junctions. */
function distanceToSegment(p, a, b) {
  const dx = num(b?.x) - num(a?.x);
  const dz = num(b?.z) - num(a?.z);
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-9) return Math.hypot(num(p?.x) - num(a?.x), num(p?.z) - num(a?.z));
  let t = ((num(p?.x) - num(a?.x)) * dx + (num(p?.z) - num(a?.z)) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(num(p?.x) - (num(a?.x) + t * dx), num(p?.z) - (num(a?.z) + t * dz));
}

function bbox(points) {
  if (points.length === 0) return null;
  const xs = points.map((p) => num(p.x));
  const zs = points.map((p) => num(p.z));
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

export function runChecks(elements) {
  const walls = of(elements, "wall");
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const openings = openingsOf(elements);
  // Storeys are levels that contain walls. Counting every distinct `level`
  // value instead would treat the roof of a single-storey building — correctly
  // placed one storey up — as a second floor.
  const levels = [...new Set(walls.map((w) => num(w.level)))].sort(
    (a, b) => a - b,
  );

  const failures = [];
  const check = (id, offenders, total, describe) =>
    failures.push({
      id,
      failed: offenders.length,
      total,
      pass: offenders.length === 0,
      detail: offenders.slice(0, 4).map(describe).join("; "),
    });

  // ── Openings ────────────────────────────────────────────────
  const unresolved = openings.filter(
    (o) => !o.hostWallId || !wallById.has(o.hostWallId),
  );
  check("host_resolution", unresolved, openings.length, (o) =>
    `${o.type} "${o.name ?? o.id}" -> ${o.hostWallId ?? "(none)"}`);

  const hosted = openings.filter((o) => wallById.has(o.hostWallId));

  const levelMismatch = hosted.filter(
    (o) => num(o.level) !== num(wallById.get(o.hostWallId).level),
  );
  check("host_level_match", levelMismatch, hosted.length, (o) =>
    `${o.id} at level ${num(o.level)} on wall at ${num(wallById.get(o.hostWallId).level)}`);

  const offWall = [];
  const outOfSpan = [];
  for (const o of hosted) {
    const wall = wallById.get(o.hostWallId);
    const geo = wallGeometry(wall);
    if (!geo) continue;
    const { along, perp } = projectOnto(wall, geo, o.start);
    if (perp > geo.thickness + 0.1) {
      offWall.push({ o, perp });
      continue;
    }
    const width = num(o.params?.width, 0.9);
    // A door hard against a corner legitimately overhangs the wall centerline
    // by a few centimetres, and computeWallJoins extends the drawn wall past
    // that length anyway, so the renderer nudges a slight overhang back inside
    // the span. Mirror that tolerance here: flagging a 5cm overhang as a
    // failure buries the openings that genuinely miss their wall.
    const overhang = Math.max(
      width / 2 - along,
      along + width / 2 - geo.length,
      0,
    );
    if (width > geo.length || overhang > Math.max(geo.thickness, 0.15)) {
      outOfSpan.push({ o, along, length: geo.length, width });
    }
  }
  check("opening_on_wall", offWall, hosted.length, ({ o, perp }) =>
    `${o.id} is ${perp.toFixed(2)}m off its wall centerline`);
  check("opening_within_span", outOfSpan, hosted.length, ({ o, along, length, width }) =>
    `${o.id} spans ${(along - width / 2).toFixed(2)}..${(along + width / 2).toFixed(2)} on a ${length.toFixed(2)}m wall`);

  const overlaps = [];
  const byHost = new Map();
  for (const o of hosted) {
    const wall = wallById.get(o.hostWallId);
    const geo = wallGeometry(wall);
    if (!geo) continue;
    const { along } = projectOnto(wall, geo, o.start);
    const width = num(o.params?.width, 0.9);
    const list = byHost.get(o.hostWallId) ?? [];
    list.push({ id: o.id, lo: along - width / 2, hi: along + width / 2 });
    byHost.set(o.hostWallId, list);
  }
  for (const [wallId, list] of byHost) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].lo < list[j].hi - EPS && list[j].lo < list[i].hi - EPS) {
          overlaps.push({ wallId, a: list[i].id, b: list[j].id });
        }
      }
    }
  }
  check("opening_no_overlap", overlaps, hosted.length, ({ a, b }) =>
    `${a} overlaps ${b}`);

  // ── Walls ───────────────────────────────────────────────────
  const degenerate = walls.filter((w) => !wallGeometry(w));
  check("wall_not_degenerate", degenerate, walls.length, (w) =>
    `${w.id} has zero length`);

  // An endpoint counts as connected if it meets another wall's endpoint OR lands
  // on another wall's span. The second case is a T-junction — an interior
  // partition ending against an exterior wall — which is correct architecture,
  // not a gap. Requiring endpoint-to-endpoint contact flags every partition in a
  // normal floor plan.
  const openEnds = [];
  for (const level of levels) {
    const levelWalls = walls.filter((w) => num(w.level) === level);
    for (const wall of levelWalls) {
      for (const key of ["start", "end"]) {
        const point = wall[key];
        const joined = levelWalls.some(
          (other) =>
            other.id !== wall.id &&
            distanceToSegment(point, other.start, other.end) <= JOIN_TOL,
        );
        if (!joined) openEnds.push({ wall, key });
      }
    }
  }
  check("wall_loop_closure", openEnds, walls.length * 2, ({ wall, key }) =>
    `${wall.id}.${key} meets no other wall`);

  // ── Structure ───────────────────────────────────────────────
  const slabLevels = new Set(of(elements, "slab").map((s) => num(s.level)));
  const missingSlab = levels.filter((l) => !slabLevels.has(l));
  check("level_has_slab", missingSlab, levels.length, (l) =>
    `level ${l} has walls but no slab`);

  const stairs = of(elements, "stair");
  const missingStair = levels.length > 1 && stairs.length === 0 ? ["multi-story"] : [];
  check("multistory_has_stair", missingStair, 1, () =>
    `${levels.length} levels but no stair element`);

  const roofs = of(elements, "roof");
  const missingRoof = roofs.length === 0 && walls.length > 0 ? ["no-roof"] : [];
  check("has_roof", missingRoof, 1, () => "building has walls but no roof");

  // Coordinates that fell back to the origin are the signature of malformed
  // upstream input, since validatePoint returns {x:0,z:0} for anything unparseable.
  const atOrigin = elements.filter(
    (e) =>
      e?.type !== undefined &&
      num(e.start?.x) === 0 &&
      num(e.start?.z) === 0 &&
      num(e.end?.x) === 0 &&
      num(e.end?.z) === 0,
  );
  check("no_origin_cluster", atOrigin.length > 1 ? atOrigin : [], elements.length, (e) =>
    `${e.id} sits at the origin`);

  const nonFinite = elements.filter((e) =>
    [e?.start?.x, e?.start?.z, e?.end?.x, e?.end?.z].some(
      (v) => v !== undefined && !Number.isFinite(v),
    ),
  );
  check("finite_coordinates", nonFinite, elements.length, (e) =>
    `${e.id} has a non-finite coordinate`);

  const wallBox = bbox(walls.flatMap((w) => [w.start ?? {}, w.end ?? {}]));

  return {
    checks: failures,
    stats: {
      elements: elements.length,
      walls: walls.length,
      doors: of(elements, "door").length,
      windows: of(elements, "window").length,
      slabs: of(elements, "slab").length,
      roofs: roofs.length,
      stairs: stairs.length,
      columns: of(elements, "column").length,
      levels: levels.length,
      footprint: wallBox
        ? [
            Number((wallBox.maxX - wallBox.minX).toFixed(2)),
            Number((wallBox.maxZ - wallBox.minZ).toFixed(2)),
          ]
        : null,
    },
  };
}

export const CHECK_IDS = [
  "host_resolution",
  "host_level_match",
  "opening_on_wall",
  "opening_within_span",
  "opening_no_overlap",
  "wall_not_degenerate",
  "wall_loop_closure",
  "level_has_slab",
  "multistory_has_stair",
  "has_roof",
  "no_origin_cluster",
  "finite_coordinates",
];
