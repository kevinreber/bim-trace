import * as THREE from "three";
import type {
  BimConstraint,
  BimElement,
  BimElementType,
  BimMaterialType,
  DetailLevel,
  Topography,
} from "@/types";
import { DEFAULT_ELEMENT_MATERIAL } from "@/types";

// ── Materials ──────────────────────────────────────────────────

export const ELEMENT_MATERIALS: Record<
  BimElementType,
  THREE.MeshStandardMaterial
> = {
  wall: new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.9 }),
  column: new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.6 }),
  slab: new THREE.MeshStandardMaterial({ color: 0xbab5ab, roughness: 0.85 }),
  door: new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.65 }),
  window: new THREE.MeshStandardMaterial({
    color: 0x87ceeb,
    roughness: 0.1,
    transparent: true,
    opacity: 0.5,
    metalness: 0.2,
  }),
  beam: new THREE.MeshStandardMaterial({
    color: 0xa0a0a0,
    roughness: 0.5,
    metalness: 0.3,
  }),
  ceiling: new THREE.MeshStandardMaterial({
    color: 0xf5f5f0,
    roughness: 0.95,
  }),
  roof: new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.85 }),
  stair: new THREE.MeshStandardMaterial({ color: 0xc8b89a, roughness: 0.8 }),
  railing: new THREE.MeshStandardMaterial({
    color: 0x404040,
    roughness: 0.4,
    metalness: 0.6,
  }),
  curtainWall: new THREE.MeshStandardMaterial({
    color: 0x6ec6e6,
    roughness: 0.05,
    transparent: true,
    opacity: 0.45,
    metalness: 0.3,
  }),
  table: new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.7 }),
  chair: new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.75 }),
  shelving: new THREE.MeshStandardMaterial({
    color: 0x9e7c4f,
    roughness: 0.7,
  }),
  desk: new THREE.MeshStandardMaterial({ color: 0x7a5c3c, roughness: 0.7 }),
  toilet: new THREE.MeshStandardMaterial({
    color: 0xf0f0f0,
    roughness: 0.3,
    metalness: 0.1,
  }),
  sink: new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.3,
    metalness: 0.1,
  }),
  duct: new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.5,
    metalness: 0.4,
  }),
  pipe: new THREE.MeshStandardMaterial({
    color: 0x606060,
    roughness: 0.4,
    metalness: 0.5,
  }),
  lightFixture: new THREE.MeshStandardMaterial({
    color: 0xe0e0e0,
    roughness: 0.3,
    metalness: 0.2,
  }),
  room: new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    roughness: 0.9,
    transparent: true,
    opacity: 0.2,
  }),
};

// ── Material Library ──────────────────────────────────────────

export const MATERIAL_LIBRARY: Record<
  BimMaterialType,
  THREE.MeshStandardMaterial
> = {
  concrete: new THREE.MeshStandardMaterial({
    color: 0xbab5ab,
    roughness: 0.9,
    metalness: 0.0,
  }),
  wood: new THREE.MeshStandardMaterial({
    color: 0x8b5e3c,
    roughness: 0.7,
    metalness: 0.0,
  }),
  steel: new THREE.MeshStandardMaterial({
    color: 0xa0a0a0,
    roughness: 0.35,
    metalness: 0.7,
  }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x87ceeb,
    roughness: 0.05,
    metalness: 0.2,
    transparent: true,
    opacity: 0.45,
  }),
  brick: new THREE.MeshStandardMaterial({
    color: 0xa0522d,
    roughness: 0.85,
    metalness: 0.0,
  }),
  stone: new THREE.MeshStandardMaterial({
    color: 0x8e8e85,
    roughness: 0.8,
    metalness: 0.0,
  }),
  drywall: new THREE.MeshStandardMaterial({
    color: 0xf5f5f0,
    roughness: 0.95,
    metalness: 0.0,
  }),
  aluminum: new THREE.MeshStandardMaterial({
    color: 0xc0c0c0,
    roughness: 0.4,
    metalness: 0.6,
  }),
};

/** Resolve the material for a BIM element, falling back to the type default */
export function getMaterialForElement(
  el: BimElement,
): THREE.MeshStandardMaterial {
  const matKey = el.material ?? DEFAULT_ELEMENT_MATERIAL[el.type];
  return MATERIAL_LIBRARY[matKey];
}

// ── Ghost / Snap Materials ────────────────────────────────────

export const GHOST_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x4ade80,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
});

export const INVALID_GHOST_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xef4444,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
});

export const SNAP_INDICATOR_MAT = new THREE.MeshBasicMaterial({
  color: 0x4ade80,
  depthTest: false,
});

// ── Wall opening interface ────────────────────────────────────

export interface WallOpening {
  centerAlongWall: number;
  width: number;
  height: number;
  bottomOffset: number;
}

// ── Wall join types ──────────────────────────────────────────

/** How much to extend or trim a wall endpoint for a clean join */
export interface WallJoinAdjustment {
  /** Extension at the start of the wall (positive = extend, negative = trim) */
  startExtension: number;
  /** Extension at the end of the wall (positive = extend, negative = trim) */
  endExtension: number;
}

/** Tolerance for snapping wall endpoints together (meters) */
const WALL_JOIN_TOLERANCE = 0.15;

/**
 * Compute wall join adjustments for all walls.
 * Detects L-joints (corner) and T-joints where wall endpoints meet,
 * and computes geometry extensions/trims for clean mitered corners.
 */
export function computeWallJoins(
  walls: BimElement[],
): Map<string, WallJoinAdjustment> {
  const adjustments = new Map<string, WallJoinAdjustment>();

  // Initialize all walls with zero adjustment
  for (const w of walls) {
    adjustments.set(w.id, { startExtension: 0, endExtension: 0 });
  }

  // For each pair of walls, check if their endpoints connect
  for (let i = 0; i < walls.length; i++) {
    const wA = walls[i];
    const thA = (wA.params as { thickness: number }).thickness;
    const dxA = wA.end.x - wA.start.x;
    const dzA = wA.end.z - wA.start.z;
    const lenA = Math.sqrt(dxA * dxA + dzA * dzA);
    if (lenA < 0.01) continue;
    // Wall A direction unit vector
    const dirAx = dxA / lenA;
    const dirAz = dzA / lenA;

    for (let j = i + 1; j < walls.length; j++) {
      const wB = walls[j];
      const thB = (wB.params as { thickness: number }).thickness;
      const dxB = wB.end.x - wB.start.x;
      const dzB = wB.end.z - wB.start.z;
      const lenB = Math.sqrt(dxB * dxB + dzB * dzB);
      if (lenB < 0.01) continue;
      const dirBx = dxB / lenB;
      const dirBz = dzB / lenB;

      // Check all 4 endpoint combinations: A.start↔B.start, A.start↔B.end,
      // A.end↔B.start, A.end↔B.end
      const endpoints: Array<{
        ptA: { x: number; z: number };
        ptB: { x: number; z: number };
        aIsStart: boolean;
        bIsStart: boolean;
      }> = [
        { ptA: wA.start, ptB: wB.start, aIsStart: true, bIsStart: true },
        { ptA: wA.start, ptB: wB.end, aIsStart: true, bIsStart: false },
        { ptA: wA.end, ptB: wB.start, aIsStart: false, bIsStart: true },
        { ptA: wA.end, ptB: wB.end, aIsStart: false, bIsStart: false },
      ];

      for (const ep of endpoints) {
        const dist = Math.sqrt(
          (ep.ptA.x - ep.ptB.x) ** 2 + (ep.ptA.z - ep.ptB.z) ** 2,
        );
        if (dist > WALL_JOIN_TOLERANCE) continue;

        // Walls are connected at this endpoint pair
        // Compute the angle between the two wall directions
        const dot = dirAx * dirBx + dirAz * dirBz;
        const cross = dirAx * dirBz - dirAz * dirBx;
        const absDot = Math.abs(dot);
        const absCross = Math.abs(cross);

        // Skip near-parallel walls (collinear, angle < 10°)
        if (absCross < 0.17) continue;

        // Compute miter extension for each wall
        // For a corner join, each wall extends by half the other wall's thickness / sin(angle)
        const sinAngle = absCross; // |sin(θ)| since dirs are unit vectors
        const extA = thB / 2 / sinAngle;
        const extB = thA / 2 / sinAngle;

        // Cap extension to prevent extreme values at very acute angles
        const maxExt = Math.max(thA, thB) * 2;
        const clampedExtA = Math.min(extA, maxExt);
        const clampedExtB = Math.min(extB, maxExt);

        const adjA = adjustments.get(wA.id)!;
        const adjB = adjustments.get(wB.id)!;

        // For wall A: if the connection is at its start, extend the start; if at end, extend the end
        if (ep.aIsStart) {
          adjA.startExtension = Math.max(adjA.startExtension, clampedExtA);
        } else {
          adjA.endExtension = Math.max(adjA.endExtension, clampedExtA);
        }

        if (ep.bIsStart) {
          adjB.startExtension = Math.max(adjB.startExtension, clampedExtB);
        } else {
          adjB.endExtension = Math.max(adjB.endExtension, clampedExtB);
        }
      }

      // T-joint detection: check if one wall's endpoint lands on the other wall's body
      checkTJoint(
        wA,
        wB,
        dirAx,
        dirAz,
        lenA,
        thA,
        dirBx,
        dirBz,
        lenB,
        thB,
        adjustments,
      );
      checkTJoint(
        wB,
        wA,
        dirBx,
        dirBz,
        lenB,
        thB,
        dirAx,
        dirAz,
        lenA,
        thA,
        adjustments,
      );
    }
  }

  return adjustments;
}

/**
 * Check if wall B's endpoints land on wall A's body (T-joint).
 * If so, extend wall B to reach wall A's centerline.
 */
function checkTJoint(
  wA: BimElement,
  wB: BimElement,
  dirAx: number,
  dirAz: number,
  lenA: number,
  thA: number,
  _dirBx: number,
  _dirBz: number,
  _lenB: number,
  _thB: number,
  adjustments: Map<string, WallJoinAdjustment>,
): void {
  // Normal of wall A (perpendicular)
  const normAx = -dirAz;
  const normAz = dirAx;

  for (const bIsStart of [true, false]) {
    const pt = bIsStart ? wB.start : wB.end;

    // Project pt onto wall A's axis
    const relX = pt.x - wA.start.x;
    const relZ = pt.z - wA.start.z;
    const along = relX * dirAx + relZ * dirAz;
    const perp = Math.abs(relX * normAx + relZ * normAz);

    // Check if point is within wall A's length range and near its surface
    if (along < -WALL_JOIN_TOLERANCE || along > lenA + WALL_JOIN_TOLERANCE)
      continue;
    if (perp > thA * 0.5 + WALL_JOIN_TOLERANCE && perp < thA * 1.5) {
      // Wall B endpoint is near wall A's surface — extend B to reach A's centerline
      const ext = perp - thA * 0.5;
      if (ext > 0 && ext < thA * 2) {
        const adjB = adjustments.get(wB.id)!;
        if (bIsStart) {
          adjB.startExtension = Math.max(adjB.startExtension, thA / 2);
        } else {
          adjB.endExtension = Math.max(adjB.endExtension, thA / 2);
        }
      }
    }
  }
}

// ── Geometry builders ─────────────────────────────────────────

export function buildWallMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  height: number,
  thickness: number,
  level: number,
  material: THREE.Material,
  openings?: WallOpening[],
  joinAdjustment?: WallJoinAdjustment,
): THREE.Mesh {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const originalLength = Math.sqrt(dx * dx + dz * dz);
  if (originalLength < 0.01) return new THREE.Mesh();

  // Apply join extensions
  const startExt = joinAdjustment?.startExtension ?? 0;
  const endExt = joinAdjustment?.endExtension ?? 0;
  const length = originalLength + startExt + endExt;

  // Shift center to account for asymmetric extensions
  const dirX = dx / originalLength;
  const dirZ = dz / originalLength;
  const centerShiftAlongAxis = (endExt - startExt) / 2;

  let geo: THREE.BufferGeometry;

  // Always use ExtrudeGeometry when we have openings OR join adjustments
  // (openings need to be shifted to account for the start extension)
  if ((openings && openings.length > 0) || startExt > 0 || endExt > 0) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, height);
    shape.lineTo(0, height);
    shape.lineTo(0, 0);

    if (openings) {
      for (const op of openings) {
        const halfW = op.width / 2;
        // Shift opening positions by startExt since the wall shape now starts earlier
        const center = op.centerAlongWall + startExt;
        const left = Math.max(0, center - halfW);
        const right = Math.min(length, center + halfW);
        const bottom = Math.max(0, op.bottomOffset);
        const top = Math.min(height, op.bottomOffset + op.height);
        if (right <= left || top <= bottom) continue;

        const hole = new THREE.Path();
        hole.moveTo(left, bottom);
        hole.lineTo(right, bottom);
        hole.lineTo(right, top);
        hole.lineTo(left, top);
        hole.lineTo(left, bottom);
        shape.holes.push(hole);
      }
    }

    geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
    });
    geo.translate(0, 0, -thickness / 2);
    geo.translate(-length / 2, -height / 2, 0);
  } else {
    geo = new THREE.BoxGeometry(length, height, thickness);
  }

  const mesh = new THREE.Mesh(geo, material);
  const cx = (start.x + end.x) / 2 + dirX * centerShiftAlongAxis;
  const cz = (start.z + end.z) / 2 + dirZ * centerShiftAlongAxis;
  mesh.position.set(cx, level + height / 2, cz);
  mesh.rotation.y = -Math.atan2(dz, dx);
  return mesh;
}

export function buildColumnMesh(
  pos: { x: number; z: number },
  height: number,
  radius: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 16);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos.x, level + height / 2, pos.z);
  return mesh;
}

export function buildSlabMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  thickness: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const width = Math.abs(end.x - start.x);
  const depth = Math.abs(end.z - start.z);
  if (width < 0.01 || depth < 0.01) return new THREE.Mesh();

  const geo = new THREE.BoxGeometry(width, thickness, depth);
  const mesh = new THREE.Mesh(geo, material);
  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;
  mesh.position.set(cx, level + thickness / 2, cz);
  return mesh;
}

export function buildDoorMesh(
  pos: { x: number; z: number },
  height: number,
  width: number,
  level: number,
  material: THREE.Material,
  rotation?: number,
): THREE.Mesh {
  const doorDepth = 0.12;
  const geo = new THREE.BoxGeometry(width, height, doorDepth);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos.x, level + height / 2, pos.z);
  if (rotation !== undefined) {
    mesh.rotation.y = rotation;
  }
  return mesh;
}

export function buildWindowMesh(
  pos: { x: number; z: number },
  height: number,
  width: number,
  sillHeight: number,
  level: number,
  material: THREE.Material,
  rotation?: number,
): THREE.Mesh {
  const glassGeo = new THREE.BoxGeometry(width, height, 0.04);
  const mesh = new THREE.Mesh(glassGeo, material);
  mesh.position.set(pos.x, level + sillHeight + height / 2, pos.z);
  if (rotation !== undefined) {
    mesh.rotation.y = rotation;
  }

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xdcdcdc,
    roughness: 0.4,
  });
  const ft = 0.04;

  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(width + ft, ft, 0.06),
    frameMat,
  );
  topBar.position.set(0, height / 2, 0);
  mesh.add(topBar);

  const bottomBar = new THREE.Mesh(
    new THREE.BoxGeometry(width + ft, ft, 0.06),
    frameMat,
  );
  bottomBar.position.set(0, -height / 2, 0);
  mesh.add(bottomBar);

  const leftBar = new THREE.Mesh(
    new THREE.BoxGeometry(ft, height, 0.06),
    frameMat,
  );
  leftBar.position.set(-width / 2, 0, 0);
  mesh.add(leftBar);

  const rightBar = new THREE.Mesh(
    new THREE.BoxGeometry(ft, height, 0.06),
    frameMat,
  );
  rightBar.position.set(width / 2, 0, 0);
  mesh.add(rightBar);

  return mesh;
}

export function buildBeamMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  height: number,
  width: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.01) return new THREE.Mesh();

  const geo = new THREE.BoxGeometry(length, height, width);
  const mesh = new THREE.Mesh(geo, material);
  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;
  mesh.position.set(cx, level + height / 2, cz);
  mesh.rotation.y = -Math.atan2(dz, dx);
  return mesh;
}

export function buildCeilingMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  thickness: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const width = Math.abs(end.x - start.x);
  const depth = Math.abs(end.z - start.z);
  if (width < 0.01 || depth < 0.01) return new THREE.Mesh();

  const geo = new THREE.BoxGeometry(width, thickness, depth);
  const mesh = new THREE.Mesh(geo, material);
  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;
  mesh.position.set(cx, level + thickness / 2, cz);
  return mesh;
}

export function buildTableMesh(
  pos: { x: number; z: number },
  height: number,
  width: number,
  depth: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const topThickness = 0.04;
  const geo = new THREE.BoxGeometry(width, topThickness, depth);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos.x, level + height - topThickness / 2, pos.z);

  const legGeo = new THREE.BoxGeometry(0.04, height - topThickness, 0.04);
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a1a,
    roughness: 0.8,
  });
  const offX = width / 2 - 0.06;
  const offZ = depth / 2 - 0.06;
  const legPositions = [
    [-offX, -(height - topThickness) / 2, -offZ],
    [offX, -(height - topThickness) / 2, -offZ],
    [-offX, -(height - topThickness) / 2, offZ],
    [offX, -(height - topThickness) / 2, offZ],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, ly, lz);
    mesh.add(leg);
  }
  return mesh;
}

export function buildChairMesh(
  pos: { x: number; z: number },
  height: number,
  width: number,
  depth: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const seatHeight = height * 0.5;
  const seatThickness = 0.03;

  const seatGeo = new THREE.BoxGeometry(width, seatThickness, depth);
  const mesh = new THREE.Mesh(seatGeo, material);
  mesh.position.set(pos.x, level + seatHeight, pos.z);

  const backGeo = new THREE.BoxGeometry(width, height - seatHeight, 0.03);
  const back = new THREE.Mesh(backGeo, material);
  back.position.set(0, (height - seatHeight) / 2, -depth / 2 + 0.015);
  mesh.add(back);

  const legGeo = new THREE.CylinderGeometry(0.015, 0.015, seatHeight, 6);
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a,
    roughness: 0.8,
  });
  const offX = width / 2 - 0.04;
  const offZ = depth / 2 - 0.04;
  const legPositions = [
    [-offX, -seatHeight / 2, -offZ],
    [offX, -seatHeight / 2, -offZ],
    [-offX, -seatHeight / 2, offZ],
    [offX, -seatHeight / 2, offZ],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, ly, lz);
    mesh.add(leg);
  }
  return mesh;
}

export function buildShelvingMesh(
  pos: { x: number; z: number },
  height: number,
  width: number,
  depth: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const shelfThickness = 0.02;
  const sideThickness = 0.02;
  const numShelves = Math.max(2, Math.round(height / 0.4));

  const containerGeo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  const mesh = new THREE.Mesh(containerGeo, material);
  mesh.position.set(pos.x, level + height / 2, pos.z);

  const sideGeo = new THREE.BoxGeometry(sideThickness, height, depth);
  const leftSide = new THREE.Mesh(sideGeo, material);
  leftSide.position.set(-width / 2, 0, 0);
  mesh.add(leftSide);

  const rightSide = new THREE.Mesh(sideGeo, material);
  rightSide.position.set(width / 2, 0, 0);
  mesh.add(rightSide);

  const backGeo = new THREE.BoxGeometry(width, height, 0.01);
  const backMat = new THREE.MeshStandardMaterial({
    color: 0x7a5c3a,
    roughness: 0.8,
  });
  const backPanel = new THREE.Mesh(backGeo, backMat);
  backPanel.position.set(0, 0, -depth / 2 + 0.005);
  mesh.add(backPanel);

  const shelfGeo = new THREE.BoxGeometry(
    width - sideThickness * 2,
    shelfThickness,
    depth,
  );
  for (let i = 0; i < numShelves; i++) {
    const shelf = new THREE.Mesh(shelfGeo, material);
    const y = -height / 2 + (i / (numShelves - 1)) * height;
    shelf.position.set(0, y, 0);
    mesh.add(shelf);
  }
  return mesh;
}

export function buildRoofMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  height: number,
  thickness: number,
  overhang: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const width = Math.abs(end.x - start.x) + overhang * 2;
  const depth = Math.abs(end.z - start.z) + overhang * 2;
  if (width < 0.01 || depth < 0.01) return new THREE.Mesh();

  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;

  const halfW = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, 0);
  shape.lineTo(halfW, 0);
  shape.lineTo(0, height);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(cx, level, cz - depth / 2);

  const baseGeo = new THREE.BoxGeometry(width, thickness, depth);
  const baseMesh = new THREE.Mesh(baseGeo, material);
  baseMesh.position.set(0, thickness / 2, depth / 2);
  mesh.add(baseMesh);

  return mesh;
}

export function buildStairMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  riserHeight: number,
  treadDepth: number,
  width: number,
  numRisers: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.01) return new THREE.Mesh();

  const containerGeo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  const mesh = new THREE.Mesh(containerGeo, material);
  mesh.position.set(start.x, level, start.z);
  mesh.rotation.y = -Math.atan2(dz, dx);

  for (let i = 0; i < numRisers; i++) {
    const treadGeo = new THREE.BoxGeometry(treadDepth, 0.03, width);
    const tread = new THREE.Mesh(treadGeo, material);
    tread.position.set(
      i * treadDepth + treadDepth / 2,
      (i + 1) * riserHeight - 0.015,
      0,
    );
    mesh.add(tread);

    const riserGeo = new THREE.BoxGeometry(0.03, riserHeight, width);
    const riser = new THREE.Mesh(riserGeo, material);
    riser.position.set(i * treadDepth, i * riserHeight + riserHeight / 2, 0);
    mesh.add(riser);
  }
  return mesh;
}

export function buildRailingMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  height: number,
  postSpacing: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.01) return new THREE.Mesh();

  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;
  const rotation = -Math.atan2(dz, dx);

  const containerGeo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  const mesh = new THREE.Mesh(containerGeo, material);
  mesh.position.set(cx, level, cz);
  mesh.rotation.y = rotation;

  const postRadius = 0.025;
  const railRadius = 0.02;

  const railGeo = new THREE.CylinderGeometry(railRadius, railRadius, length, 8);
  railGeo.rotateZ(Math.PI / 2);
  const topRail = new THREE.Mesh(railGeo, material);
  topRail.position.set(0, height, 0);
  mesh.add(topRail);

  const midRail = new THREE.Mesh(railGeo, material);
  midRail.position.set(0, height * 0.5, 0);
  mesh.add(midRail);

  const numPosts = Math.max(2, Math.floor(length / postSpacing) + 1);
  const actualSpacing = length / (numPosts - 1);
  const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, height, 8);

  for (let i = 0; i < numPosts; i++) {
    const post = new THREE.Mesh(postGeo, material);
    post.position.set(-length / 2 + i * actualSpacing, height / 2, 0);
    mesh.add(post);
  }
  return mesh;
}

export function buildCurtainWallMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  height: number,
  panelWidth: number,
  panelHeight: number,
  mullionSize: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.01) return new THREE.Mesh();

  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;
  const rotation = -Math.atan2(dz, dx);

  const containerGeo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  const mesh = new THREE.Mesh(containerGeo, material);
  mesh.position.set(cx, level, cz);
  mesh.rotation.y = rotation;

  const mullionMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.3,
    metalness: 0.7,
  });

  const numCols = Math.max(1, Math.round(length / panelWidth));
  const numRows = Math.max(1, Math.round(height / panelHeight));
  const actualPW = length / numCols;
  const actualPH = height / numRows;

  const panelGeo = new THREE.BoxGeometry(
    actualPW - mullionSize,
    actualPH - mullionSize,
    0.02,
  );
  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < numRows; row++) {
      const panel = new THREE.Mesh(panelGeo, material);
      panel.position.set(
        -length / 2 + actualPW / 2 + col * actualPW,
        actualPH / 2 + row * actualPH,
        0,
      );
      mesh.add(panel);
    }
  }

  const vMullionGeo = new THREE.BoxGeometry(mullionSize, height, mullionSize);
  for (let i = 0; i <= numCols; i++) {
    const mullion = new THREE.Mesh(vMullionGeo, mullionMat);
    mullion.position.set(-length / 2 + i * actualPW, height / 2, 0);
    mesh.add(mullion);
  }

  const hMullionGeo = new THREE.BoxGeometry(length, mullionSize, mullionSize);
  for (let i = 0; i <= numRows; i++) {
    const mullion = new THREE.Mesh(hMullionGeo, mullionMat);
    mullion.position.set(0, i * actualPH, 0);
    mesh.add(mullion);
  }
  return mesh;
}

export function buildDeskMesh(
  pos: { x: number; z: number },
  height: number,
  width: number,
  depth: number,
  lShaped: boolean,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const topThickness = 0.04;
  const geo = new THREE.BoxGeometry(width, topThickness, depth);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos.x, level + height - topThickness / 2, pos.z);

  const legGeo = new THREE.BoxGeometry(0.04, height - topThickness, 0.04);
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a1a,
    roughness: 0.8,
  });
  const offX = width / 2 - 0.06;
  const offZ = depth / 2 - 0.06;
  const legPositions = [
    [-offX, -(height - topThickness) / 2, -offZ],
    [offX, -(height - topThickness) / 2, -offZ],
    [-offX, -(height - topThickness) / 2, offZ],
    [offX, -(height - topThickness) / 2, offZ],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, ly, lz);
    mesh.add(leg);
  }

  if (lShaped) {
    const extWidth = depth;
    const extDepth = depth / 2;
    const extGeo = new THREE.BoxGeometry(extWidth, topThickness, extDepth);
    const ext = new THREE.Mesh(extGeo, material);
    ext.position.set(
      width / 2 + extWidth / 2 - 0.04,
      0,
      depth / 2 - extDepth / 2,
    );
    mesh.add(ext);

    const extOffX = extWidth / 2 - 0.06;
    const extOffZ = extDepth / 2 - 0.06;
    const extLegPositions = [
      [extOffX, -(height - topThickness) / 2, -extOffZ],
      [extOffX, -(height - topThickness) / 2, extOffZ],
    ];
    for (const [lx, ly, lz] of extLegPositions) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(
        width / 2 + extWidth / 2 - 0.04 + lx,
        ly,
        depth / 2 - extDepth / 2 + lz,
      );
      mesh.add(leg);
    }
  }
  return mesh;
}

export function buildToiletMesh(
  pos: { x: number; z: number },
  height: number,
  width: number,
  depth: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const baseHeight = height * 0.6;
  const baseGeo = new THREE.BoxGeometry(width, baseHeight, depth * 0.65);
  const mesh = new THREE.Mesh(baseGeo, material);
  mesh.position.set(pos.x, level + baseHeight / 2, pos.z);

  const tankW = width * 0.8;
  const tankH = height * 0.5;
  const tankD = depth * 0.25;
  const tankGeo = new THREE.BoxGeometry(tankW, tankH, tankD);
  const tank = new THREE.Mesh(tankGeo, material);
  tank.position.set(
    0,
    baseHeight / 2 + tankH / 2 - baseHeight / 2,
    (-depth * 0.65) / 2 - tankD / 2,
  );
  mesh.add(tank);
  return mesh;
}

export function buildSinkMesh(
  pos: { x: number; z: number },
  height: number,
  width: number,
  depth: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const pedestalGeo = new THREE.BoxGeometry(0.1, height, 0.1);
  const mesh = new THREE.Mesh(pedestalGeo, material);
  mesh.position.set(pos.x, level + height / 2, pos.z);

  const basinGeo = new THREE.BoxGeometry(width, 0.15, depth);
  const basin = new THREE.Mesh(basinGeo, material);
  basin.position.set(0, height / 2 - 0.075, 0);
  mesh.add(basin);

  const faucetMat = new THREE.MeshStandardMaterial({
    color: 0xc0c0c0,
    roughness: 0.3,
    metalness: 0.7,
  });
  const faucetGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8);
  const faucet = new THREE.Mesh(faucetGeo, faucetMat);
  faucet.position.set(0, height / 2 + 0.075, -depth / 2 + 0.04);
  mesh.add(faucet);
  return mesh;
}

export function buildDuctMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  height: number,
  width: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.01) return new THREE.Mesh();

  const geo = new THREE.BoxGeometry(length, height, width);
  const mesh = new THREE.Mesh(geo, material);
  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;
  mesh.position.set(cx, level + height / 2, cz);
  mesh.rotation.y = -Math.atan2(dz, dx);
  return mesh;
}

export function buildPipeMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  diameter: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.01) return new THREE.Mesh();

  const radius = diameter / 2;
  const geo = new THREE.CylinderGeometry(radius, radius, length, 16);
  const mesh = new THREE.Mesh(geo, material);
  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;
  mesh.position.set(cx, level + radius, cz);
  mesh.rotation.y = -Math.atan2(dz, dx);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

export function buildLightFixtureMesh(
  pos: { x: number; z: number },
  width: number,
  depth: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const panelThickness = 0.03;
  const geo = new THREE.BoxGeometry(width, panelThickness, depth);

  const glowMat = (material as THREE.MeshStandardMaterial).clone();
  glowMat.emissive = new THREE.Color(0xffffee);
  glowMat.emissiveIntensity = 0.3;

  const mesh = new THREE.Mesh(geo, glowMat);
  mesh.position.set(pos.x, level - panelThickness / 2, pos.z);
  return mesh;
}

// ── Room ─────────────────────────────────────────────────────

export function buildRoomMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  height: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const dx = Math.abs(end.x - start.x);
  const dz = Math.abs(end.z - start.z);
  const w = Math.max(dx, 0.1);
  const d = Math.max(dz, 0.1);
  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;

  // Semi-transparent colored floor slab for the room
  const roomMat = (material as THREE.MeshStandardMaterial).clone();
  roomMat.color = new THREE.Color(0x93c5fd);
  roomMat.transparent = true;
  roomMat.opacity = 0.18;
  roomMat.side = THREE.DoubleSide;
  roomMat.depthWrite = false;

  const geo = new THREE.BoxGeometry(w, 0.02, d);
  const mesh = new THREE.Mesh(geo, roomMat);
  mesh.position.set(cx, level + 0.01, cz);
  mesh.renderOrder = 10;

  // Add a border wireframe to outline the room
  const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, height, d));
  const edgesMat = new THREE.LineBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.4,
  });
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  edges.position.set(0, height / 2 - 0.01, 0);
  mesh.add(edges);

  return mesh;
}

// ── Coarse LOD (simple bounding box for all element types) ────

function buildCoarseMesh(el: BimElement, material: THREE.Material): THREE.Mesh {
  const p = el.params as Record<string, number>;
  const height = p.height ?? 3;
  const thickness = p.thickness ?? p.width ?? p.radius ?? p.diameter ?? 0.2;
  const depth = p.depth ?? thickness;

  const dx = el.end.x - el.start.x;
  const dz = el.end.z - el.start.z;
  const length = Math.sqrt(dx * dx + dz * dz);

  // Linear elements (walls, beams, etc.)
  if (length > 0.1) {
    const geo = new THREE.BoxGeometry(
      Math.max(length, 0.1),
      height,
      Math.max(thickness, 0.1),
    );
    const mesh = new THREE.Mesh(geo, material);
    const cx = (el.start.x + el.end.x) / 2;
    const cz = (el.start.z + el.end.z) / 2;
    mesh.position.set(cx, el.level + height / 2, cz);
    mesh.rotation.y = -Math.atan2(dz, dx);
    return mesh;
  }

  // Point elements (columns, furniture, fixtures)
  const w = Math.max(thickness, 0.1);
  const d = Math.max(depth, 0.1);
  const geo = new THREE.BoxGeometry(w, height, d);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(el.start.x, el.level + height / 2, el.start.z);
  if (el.rotation) mesh.rotation.y = el.rotation;
  return mesh;
}

// ── Room area computation ─────────────────────────────────────

/**
 * Compute the area of a room element.
 * For rectangular rooms (defined by start/end), area = width × depth.
 * Returns area in square meters.
 */
export function computeRoomArea(room: BimElement): number {
  const dx = Math.abs(room.end.x - room.start.x);
  const dz = Math.abs(room.end.z - room.start.z);
  return dx * dz;
}

/**
 * Compute the perimeter of a room element.
 * Returns perimeter in meters.
 */
export function computeRoomPerimeter(room: BimElement): number {
  const dx = Math.abs(room.end.x - room.start.x);
  const dz = Math.abs(room.end.z - room.start.z);
  return 2 * (dx + dz);
}

// ── Clash detection ───────────────────────────────────────────

export interface ClashResult {
  elementA: string;
  elementB: string;
  description: string;
}

/**
 * Detect clashing (overlapping) BIM elements using bounding box intersection.
 * Returns pairs of elements whose bounding boxes overlap.
 */
export function detectClashes(elements: BimElement[]): ClashResult[] {
  const clashes: ClashResult[] = [];

  // Compute bounding boxes for each element
  const boxes: Array<{
    id: string;
    type: string;
    name: string;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  }> = [];

  for (const el of elements) {
    const p = el.params as Record<string, number>;
    const height = p.height ?? 3;
    const thickness = p.thickness ?? p.width ?? p.radius ?? p.diameter ?? 0.2;
    const half = thickness / 2;

    const minX = Math.min(el.start.x, el.end.x) - half;
    const maxX = Math.max(el.start.x, el.end.x) + half;
    const minZ = Math.min(el.start.z, el.end.z) - half;
    const maxZ = Math.max(el.start.z, el.end.z) + half;
    const minY = el.level;
    const maxY = el.level + height;

    boxes.push({
      id: el.id,
      type: el.type,
      name: el.name,
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
    });
  }

  // Check all pairs for AABB overlap
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i];
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j];

      // Skip same-type elements that are expected to share space
      // (e.g. doors/windows hosted on walls)
      const elA = elements[i];
      const elB = elements[j];
      if (elA.hostWallId === elB.id || elB.hostWallId === elA.id) continue;
      if (elA.type === "room" || elB.type === "room") continue;

      // Check AABB intersection
      if (
        a.minX < b.maxX &&
        a.maxX > b.minX &&
        a.minY < b.maxY &&
        a.maxY > b.minY &&
        a.minZ < b.maxZ &&
        a.maxZ > b.minZ
      ) {
        clashes.push({
          elementA: a.id,
          elementB: b.id,
          description: `${a.name} (${a.type}) clashes with ${b.name} (${b.type})`,
        });
      }
    }
  }

  return clashes;
}

// ── MEP connectivity ──────────────────────────────────────────

export interface MepConnection {
  elementA: string;
  elementB: string;
  point: { x: number; y: number; z: number };
  type: "elbow" | "tee" | "straight";
}

const MEP_CONNECT_TOLERANCE = 0.3;

/**
 * Detect MEP connections between ducts and pipes.
 * Returns connection points where fittings should be placed.
 */
export function detectMepConnections(elements: BimElement[]): MepConnection[] {
  const mepElements = elements.filter(
    (el) => el.type === "duct" || el.type === "pipe",
  );
  const connections: MepConnection[] = [];

  for (let i = 0; i < mepElements.length; i++) {
    const a = mepElements[i];
    for (let j = i + 1; j < mepElements.length; j++) {
      const b = mepElements[j];

      // Check all endpoint combinations
      const endpoints = [
        { ptA: a.start, ptB: b.start },
        { ptA: a.start, ptB: b.end },
        { ptA: a.end, ptB: b.start },
        { ptA: a.end, ptB: b.end },
      ];

      for (const ep of endpoints) {
        const dist = Math.sqrt(
          (ep.ptA.x - ep.ptB.x) ** 2 + (ep.ptA.z - ep.ptB.z) ** 2,
        );
        if (dist > MEP_CONNECT_TOLERANCE) continue;

        // Determine fitting type from angle between elements
        const dxA = a.end.x - a.start.x;
        const dzA = a.end.z - a.start.z;
        const dxB = b.end.x - b.start.x;
        const dzB = b.end.z - b.start.z;
        const lenA = Math.sqrt(dxA * dxA + dzA * dzA);
        const lenB = Math.sqrt(dxB * dxB + dzB * dzB);
        if (lenA < 0.01 || lenB < 0.01) continue;

        const dot = (dxA * dxB + dzA * dzB) / (lenA * lenB);
        const absDot = Math.abs(dot);

        let type: MepConnection["type"];
        if (absDot > 0.95) {
          type = "straight";
        } else if (absDot < 0.3) {
          type = "elbow";
        } else {
          type = "tee";
        }

        const midX = (ep.ptA.x + ep.ptB.x) / 2;
        const midZ = (ep.ptA.z + ep.ptB.z) / 2;
        const y = Math.max(a.level, b.level);

        connections.push({
          elementA: a.id,
          elementB: b.id,
          point: { x: midX, y, z: midZ },
          type,
        });
      }
    }
  }

  return connections;
}

/**
 * Build a fitting mesh at a connection point.
 */
export function buildFittingMesh(
  conn: MepConnection,
  material: THREE.Material,
): THREE.Mesh {
  let geo: THREE.BufferGeometry;

  switch (conn.type) {
    case "elbow": {
      // Torus segment for elbow
      geo = new THREE.TorusGeometry(0.15, 0.05, 8, 12, Math.PI / 2);
      break;
    }
    case "tee": {
      // Cross-shaped geometry
      const g1 = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
      const g2 = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
      g2.rotateZ(Math.PI / 2);
      const merged = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      geo = merged;
      break;
    }
    default: {
      // Straight coupling
      geo = new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8);
      break;
    }
  }

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(conn.point.x, conn.point.y, conn.point.z);
  return mesh;
}

// ── Topography mesh builder ───────────────────────────────────

const TERRAIN_MAT = new THREE.MeshStandardMaterial({
  color: 0x6b8e4e,
  roughness: 0.95,
  metalness: 0,
  side: THREE.DoubleSide,
  flatShading: true,
});

/**
 * Build a terrain mesh from topography elevation points.
 * Creates a grid-based heightfield using PlaneGeometry.
 */
export function buildTerrainMesh(topo: Topography): THREE.Mesh {
  if (topo.points.length < 4) return new THREE.Mesh();

  // Find bounds
  let minX = Infinity,
    maxX = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (const pt of topo.points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.z < minZ) minZ = pt.z;
    if (pt.z > maxZ) maxZ = pt.z;
  }

  const width = maxX - minX;
  const depth = maxZ - minZ;
  const segsX = Math.max(2, Math.round(width / topo.gridSize));
  const segsZ = Math.max(2, Math.round(depth / topo.gridSize));

  const geo = new THREE.PlaneGeometry(width, depth, segsX, segsZ);
  geo.rotateX(-Math.PI / 2);

  // Build a lookup for elevation at each grid point
  const posAttr = geo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const gx = posAttr.getX(i) + width / 2 + minX;
    const gz = posAttr.getZ(i) + depth / 2 + minZ;

    // Find nearest elevation point
    let nearest = topo.points[0];
    let nearDist = Infinity;
    for (const pt of topo.points) {
      const d = (pt.x - gx) ** 2 + (pt.z - gz) ** 2;
      if (d < nearDist) {
        nearDist = d;
        nearest = pt;
      }
    }
    posAttr.setY(i, nearest.elevation);
  }

  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, TERRAIN_MAT);
  mesh.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  mesh.receiveShadow = true;
  mesh.userData._terrain = true;
  return mesh;
}

// ── Parametric constraint solver ──────────────────────────────

/**
 * Apply parametric constraints to adjust element positions.
 * Returns a map of element ID → position adjustments.
 * This is a simple iterative solver — runs a few passes to converge.
 */
export function solveConstraints(
  elements: BimElement[],
  constraints: BimConstraint[],
): Map<string, { dx: number; dz: number }> {
  const adjustments = new Map<string, { dx: number; dz: number }>();
  for (const el of elements) {
    adjustments.set(el.id, { dx: 0, dz: 0 });
  }

  if (constraints.length === 0) return adjustments;

  const elMap = new Map(elements.map((el) => [el.id, el]));

  // 3 iterations to converge
  for (let iter = 0; iter < 3; iter++) {
    for (const c of constraints) {
      if (c.type === "distance" && c.elementIds.length === 2 && c.value) {
        const a = elMap.get(c.elementIds[0]);
        const b = elMap.get(c.elementIds[1]);
        if (!a || !b) continue;
        if (a.pinned && b.pinned) continue;

        const adjA = adjustments.get(a.id)!;
        const adjB = adjustments.get(b.id)!;
        const ax = (a.start.x + a.end.x) / 2 + adjA.dx;
        const az = (a.start.z + a.end.z) / 2 + adjA.dz;
        const bx = (b.start.x + b.end.x) / 2 + adjB.dx;
        const bz = (b.start.z + b.end.z) / 2 + adjB.dz;
        const dx = bx - ax;
        const dz = bz - az;
        const currentDist = Math.sqrt(dx * dx + dz * dz);
        if (currentDist < 0.001) continue;
        const error = currentDist - c.value;
        const correction = error / 2;
        const nx = dx / currentDist;
        const nz = dz / currentDist;

        if (!a.pinned) {
          adjA.dx += nx * correction;
          adjA.dz += nz * correction;
        }
        if (!b.pinned) {
          adjB.dx -= nx * correction;
          adjB.dz -= nz * correction;
        }
      } else if (c.type === "alignment" && c.axis && c.elementIds.length >= 2) {
        // Align all elements to the average position on the given axis
        const els = c.elementIds
          .map((id) => elMap.get(id))
          .filter(Boolean) as BimElement[];
        if (els.length < 2) continue;

        const avg =
          c.axis === "x"
            ? els.reduce((s, el) => s + (el.start.x + el.end.x) / 2, 0) /
              els.length
            : els.reduce((s, el) => s + (el.start.z + el.end.z) / 2, 0) /
              els.length;

        for (const el of els) {
          if (el.pinned) continue;
          const adj = adjustments.get(el.id)!;
          const center =
            c.axis === "x"
              ? (el.start.x + el.end.x) / 2 + adj.dx
              : (el.start.z + el.end.z) / 2 + adj.dz;
          const delta = avg - center;
          if (c.axis === "x") adj.dx += delta;
          else adj.dz += delta;
        }
      } else if (c.type === "equality" && c.elementIds.length >= 3) {
        // Distribute elements evenly between first and last
        const els = c.elementIds
          .map((id) => elMap.get(id))
          .filter(Boolean) as BimElement[];
        if (els.length < 3) continue;
        const sorted = [...els].sort(
          (a2, b2) => (a2.start.x + a2.end.x) / 2 - (b2.start.x + b2.end.x) / 2,
        );
        const first = (sorted[0].start.x + sorted[0].end.x) / 2;
        const last =
          (sorted[sorted.length - 1].start.x +
            sorted[sorted.length - 1].end.x) /
          2;
        const step = (last - first) / (sorted.length - 1);
        for (let i = 1; i < sorted.length - 1; i++) {
          const el = sorted[i];
          if (el.pinned) continue;
          const adj = adjustments.get(el.id)!;
          const cx = (el.start.x + el.end.x) / 2 + adj.dx;
          const target = first + step * i;
          adj.dx += target - cx;
        }
      }
    }
  }

  return adjustments;
}

// ── Wall openings ─────────────────────────────────────────────

export function computeWallOpenings(
  wall: BimElement,
  allElements: BimElement[],
): WallOpening[] {
  const openings: WallOpening[] = [];
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  if (wallLength < 0.01) return openings;

  const dirX = dx / wallLength;
  const dirZ = dz / wallLength;

  for (const el of allElements) {
    if (el.hostWallId !== wall.id) continue;
    if (el.type !== "door" && el.type !== "window") continue;

    const hx = el.start.x - wall.start.x;
    const hz = el.start.z - wall.start.z;
    const t = hx * dirX + hz * dirZ;

    const params = el.params as Record<string, number>;
    const width = params.width ?? 0.9;
    const height = params.height ?? 2.1;
    const bottomOffset = el.type === "window" ? (params.sillHeight ?? 0.9) : 0;

    openings.push({ centerAlongWall: t, width, height, bottomOffset });
  }
  return openings;
}

// ── Master dispatch ───────────────────────────────────────────

export function buildMeshForElement(
  el: BimElement,
  material: THREE.Material,
  allElements?: BimElement[],
  wallJoins?: Map<string, WallJoinAdjustment>,
  detailLevel: DetailLevel = "medium",
): THREE.Mesh {
  // Coarse mode: render everything as simple bounding boxes
  if (detailLevel === "coarse") {
    return buildCoarseMesh(el, material);
  }

  switch (el.type) {
    case "wall": {
      const p = el.params as { height: number; thickness: number };
      const openings =
        detailLevel === "fine" && allElements
          ? computeWallOpenings(el, allElements)
          : allElements
            ? computeWallOpenings(el, allElements)
            : [];
      const joinAdj = wallJoins?.get(el.id);
      return buildWallMesh(
        el.start,
        el.end,
        p.height,
        p.thickness,
        el.level,
        material,
        openings,
        joinAdj,
      );
    }
    case "column": {
      const p = el.params as { height: number; radius: number };
      return buildColumnMesh(el.start, p.height, p.radius, el.level, material);
    }
    case "slab": {
      const p = el.params as { thickness: number };
      return buildSlabMesh(el.start, el.end, p.thickness, el.level, material);
    }
    case "door": {
      const p = el.params as { height: number; width: number };
      return buildDoorMesh(
        el.start,
        p.height,
        p.width,
        el.level,
        material,
        el.rotation,
      );
    }
    case "window": {
      const p = el.params as {
        height: number;
        width: number;
        sillHeight: number;
      };
      return buildWindowMesh(
        el.start,
        p.height,
        p.width,
        p.sillHeight,
        el.level,
        material,
        el.rotation,
      );
    }
    case "beam": {
      const p = el.params as { height: number; width: number };
      return buildBeamMesh(
        el.start,
        el.end,
        p.height,
        p.width,
        el.level,
        material,
      );
    }
    case "ceiling": {
      const p = el.params as { thickness: number };
      return buildCeilingMesh(
        el.start,
        el.end,
        p.thickness,
        el.level,
        material,
      );
    }
    case "roof": {
      const p = el.params as {
        height: number;
        thickness: number;
        overhang: number;
      };
      return buildRoofMesh(
        el.start,
        el.end,
        p.height,
        p.thickness,
        p.overhang,
        el.level,
        material,
      );
    }
    case "stair": {
      const p = el.params as {
        riserHeight: number;
        treadDepth: number;
        width: number;
        numRisers: number;
      };
      return buildStairMesh(
        el.start,
        el.end,
        p.riserHeight,
        p.treadDepth,
        p.width,
        p.numRisers,
        el.level,
        material,
      );
    }
    case "railing": {
      const p = el.params as { height: number; postSpacing: number };
      return buildRailingMesh(
        el.start,
        el.end,
        p.height,
        p.postSpacing,
        el.level,
        material,
      );
    }
    case "curtainWall": {
      const p = el.params as {
        height: number;
        panelWidth: number;
        panelHeight: number;
        mullionSize: number;
      };
      return buildCurtainWallMesh(
        el.start,
        el.end,
        p.height,
        p.panelWidth,
        p.panelHeight,
        p.mullionSize,
        el.level,
        material,
      );
    }
    case "table": {
      const p = el.params as { height: number; width: number; depth: number };
      return buildTableMesh(
        el.start,
        p.height,
        p.width,
        p.depth,
        el.level,
        material,
      );
    }
    case "chair": {
      const p = el.params as { height: number; width: number; depth: number };
      return buildChairMesh(
        el.start,
        p.height,
        p.width,
        p.depth,
        el.level,
        material,
      );
    }
    case "shelving": {
      const p = el.params as { height: number; width: number; depth: number };
      return buildShelvingMesh(
        el.start,
        p.height,
        p.width,
        p.depth,
        el.level,
        material,
      );
    }
    case "desk": {
      const p = el.params as {
        height: number;
        width: number;
        depth: number;
        lShaped: boolean;
      };
      return buildDeskMesh(
        el.start,
        p.height,
        p.width,
        p.depth,
        p.lShaped,
        el.level,
        material,
      );
    }
    case "toilet": {
      const p = el.params as { height: number; width: number; depth: number };
      return buildToiletMesh(
        el.start,
        p.height,
        p.width,
        p.depth,
        el.level,
        material,
      );
    }
    case "sink": {
      const p = el.params as { height: number; width: number; depth: number };
      return buildSinkMesh(
        el.start,
        p.height,
        p.width,
        p.depth,
        el.level,
        material,
      );
    }
    case "duct": {
      const p = el.params as { height: number; width: number };
      return buildDuctMesh(
        el.start,
        el.end,
        p.height,
        p.width,
        el.level,
        material,
      );
    }
    case "pipe": {
      const p = el.params as { diameter: number };
      return buildPipeMesh(el.start, el.end, p.diameter, el.level, material);
    }
    case "lightFixture": {
      const p = el.params as { width: number; depth: number };
      return buildLightFixtureMesh(
        el.start,
        p.width,
        p.depth,
        el.level,
        material,
      );
    }
    case "room": {
      const p = el.params as { height: number };
      return buildRoomMesh(el.start, el.end, p.height, el.level, material);
    }
  }
}
