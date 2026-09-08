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


const FOOTPRINT_TOL = 0.15;
const vertexKey = (p) =>
  `${Math.round(num(p?.x) / FOOTPRINT_TOL)}:${Math.round(num(p?.z) / FOOTPRINT_TOL)}`;

/**
 * Traces the outer outline of a level's walls.
 *
 * The bounding box says nothing about shape: an L-shaped plan and a plain box
 * with the same extents score identically on `footprintMeters`, so "the model
 * defaulted to a rectangle" — the exact failure `l-shaped-plan` was added to
 * catch — was invisible. Walking the outline gives the corner count and the
 * enclosed area, which do distinguish them.
 *
 * Starts at the lowest-then-leftmost vertex, which is always on the outer
 * boundary, and at each step takes the most clockwise turn available, which
 * keeps the walk hugging the outside and ignores interior partitions.
 */
function outerBoundary(walls) {
  const verts = new Map();
  const adj = new Map();
  const add = (p) => {
    const k = vertexKey(p);
    if (!verts.has(k)) {
      verts.set(k, { x: num(p?.x), z: num(p?.z) });
      adj.set(k, new Set());
    }
    return k;
  };
  for (const w of walls) {
    const a = add(w.start);
    const b = add(w.end);
    if (a === b) continue;
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  if (verts.size < 3) return null;

  let startK = null;
  for (const [k, v] of verts) {
    if (startK === null) { startK = k; continue; }
    const s = verts.get(startK);
    if (v.z < s.z || (v.z === s.z && v.x < s.x)) startK = k;
  }

  const poly = [];
  let prevK = null;
  let curK = startK;
  let guard = verts.size * 4;
  do {
    poly.push(verts.get(curK));
    const cur = verts.get(curK);
    // On the first step, pretend we arrived travelling -X so the walk sets off
    // around the outside rather than into the building.
    const inDir = prevK
      ? Math.atan2(cur.z - verts.get(prevK).z, cur.x - verts.get(prevK).x)
      : Math.PI;
    let bestK = null;
    let bestTurn = Infinity;
    for (const nK of adj.get(curK)) {
      // Backtracking is allowed only from a dead end, where it is the sole way on.
      if (nK === prevK && adj.get(curK).size > 1) continue;
      const n = verts.get(nK);
      const out = Math.atan2(n.z - cur.z, n.x - cur.x);
      let turn = out - (inDir + Math.PI);
      while (turn <= 0) turn += Math.PI * 2;
      while (turn > Math.PI * 2) turn -= Math.PI * 2;
      if (turn < bestTurn) { bestTurn = turn; bestK = nK; }
    }
    if (!bestK) return null;
    prevK = curK;
    curK = bestK;
  } while (curK !== startK && guard-- > 0);

  return guard > 0 && poly.length >= 3 ? poly : null;
}

/**
 * Number of disconnected wall groups.
 *
 * Uses the same adjacency rule as `wall_loop_closure`: a wall joins another
 * when an endpoint lands anywhere on its span, not only at a shared endpoint.
 * Endpoint-only adjacency counts an ordinary interior partition meeting the
 * middle of an exterior wall as its own group, which is normal architecture
 * rather than a defect.
 */
function connectedGroups(walls) {
  const parent = walls.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i];
      const b = walls[j];
      const touching =
        distanceToSegment(a.start, b.start, b.end) <= JOIN_TOL ||
        distanceToSegment(a.end, b.start, b.end) <= JOIN_TOL ||
        distanceToSegment(b.start, a.start, a.end) <= JOIN_TOL ||
        distanceToSegment(b.end, a.start, a.end) <= JOIN_TOL;
      if (!touching) continue;
      const ra = find(i);
      const rb = find(j);
      if (ra !== rb) parent[ra] = rb;
    }
  }
  const groups = new Map();
  walls.forEach((w, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(w);
  });
  return [...groups.values()];
}

/**
 * Groups that stand clear of the largest one.
 *
 * Disconnection alone is not a defect: a free-standing service core inside a
 * hall touches no exterior wall and is perfectly ordinary. What is a defect is
 * a group sitting entirely outside the main building's extents, which is what
 * several buildings look like — the failure mode when several views of one
 * building arrive as a single image.
 */
function detachedGroups(walls) {
  const groups = connectedGroups(walls);
  if (groups.length < 2) return 0;
  const boxOf = (g) => bbox(g.flatMap((w) => [w.start ?? {}, w.end ?? {}]));
  const boxes = groups.map(boxOf).filter(Boolean);
  if (boxes.length < 2) return 0;
  let main = boxes[0];
  for (const b of boxes) {
    const area = (b.maxX - b.minX) * (b.maxZ - b.minZ);
    const mainArea = (main.maxX - main.minX) * (main.maxZ - main.minZ);
    if (area > mainArea) main = b;
  }
  return boxes.filter(
    (b) =>
      b !== main &&
      (b.minX > main.maxX ||
        b.maxX < main.minX ||
        b.minZ > main.maxZ ||
        b.maxZ < main.minZ),
  ).length;
}

function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

/** Only vertices that actually turn, so collinear points do not inflate the count. */
function cornerCount(poly) {
  let corners = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[(i - 1 + poly.length) % poly.length];
    const b = poly[i];
    const c = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    const len =
      Math.hypot(b.x - a.x, b.z - a.z) * Math.hypot(c.x - b.x, c.z - b.z);
    if (len > 0 && Math.abs(cross / len) > 0.05) corners++;
  }
  return corners;
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
  // Columns are excluded: they legitimately carry start === end, and the prompt
  // asks for the layout centred on the origin, so a column at the exact centre
  // of a plan is correct output rather than a parse failure.
  const atOrigin = elements.filter(
    (e) =>
      e?.type !== undefined &&
      e.type !== "column" &&
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

  // Shape, not just extents. The ground-floor outline is the one that says
  // whether the model reproduced an articulated footprint or fell back to a box.
  const groundWalls = levels.length
    ? walls.filter((w) => num(w.level) === levels[0])
    : walls;
  // A walk that returns to its start having enclosed nothing — two walls in an
  // L, traced out and back — is not an outline. Without the area floor the
  // check passed on walls that enclose no building at all.
  const traced = outerBoundary(groundWalls);
  const tracedArea = traced ? polygonArea(traced) : 0;
  const outline = tracedArea >= 1 ? traced : null;
  const outlineArea = outline ? tracedArea : null;
  // The box has to come from the outline itself, not from every ground wall.
  // Measured against all walls, a detached second building or a single stray
  // spur inflates the box and deflates the ratio, so a plain rectangle reads as
  // highly articulated — and it fails in the dangerous direction, since a low
  // fill satisfies a `maxFill` assertion.
  const outlineBox = outline ? bbox(outline) : null;
  const outlineBoxArea = outlineBox
    ? (outlineBox.maxX - outlineBox.minX) * (outlineBox.maxZ - outlineBox.minZ)
    : null;

  // A footprint whose outline cannot be walked has walls that do not enclose
  // anything, which wall_loop_closure can miss when every endpoint touches
  // something but the pieces never form a ring.
  const untraceable = groundWalls.length >= 3 && !outline ? ["outline"] : [];
  check("footprint_traceable", untraceable, 1, () =>
    "ground-floor walls do not trace a closed outline");

  // Two closed boxes standing apart pass every other check — each endpoint
  // meets another wall and each ring closes — while the outline walk silently
  // measures only one of them. This is the failure mode when several views of
  // a building arrive as one image and the model reads them as several
  // buildings. A fixture with legitimate outbuildings can skip it.
  const detached = detachedGroups(groundWalls);
  check("footprint_single_component", detached > 0 ? [detached] : [], 1, (n) =>
    `${n} wall group(s) stand clear of the main building, so the footprint describes only one of them`);

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
      footprintCorners: outline ? cornerCount(outline) : null,
      footprintArea: outlineArea == null ? null : Number(outlineArea.toFixed(1)),
      footprintFill:
        outlineArea != null && outlineBoxArea
          ? Number((outlineArea / outlineBoxArea).toFixed(2))
          : null,
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
  "footprint_traceable",
  "footprint_single_component",
];
