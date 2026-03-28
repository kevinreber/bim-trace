import * as THREE from "three";
import type { BimElement, BimElementType } from "@/types";

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
};

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

// ── Geometry builders ─────────────────────────────────────────

export function buildWallMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  height: number,
  thickness: number,
  level: number,
  material: THREE.Material,
  openings?: WallOpening[],
): THREE.Mesh {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.01) return new THREE.Mesh();

  let geo: THREE.BufferGeometry;

  if (openings && openings.length > 0) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, height);
    shape.lineTo(0, height);
    shape.lineTo(0, 0);

    for (const op of openings) {
      const halfW = op.width / 2;
      const left = Math.max(0, op.centerAlongWall - halfW);
      const right = Math.min(length, op.centerAlongWall + halfW);
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
  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;
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
): THREE.Mesh {
  switch (el.type) {
    case "wall": {
      const p = el.params as { height: number; thickness: number };
      const openings = allElements ? computeWallOpenings(el, allElements) : [];
      return buildWallMesh(
        el.start,
        el.end,
        p.height,
        p.thickness,
        el.level,
        material,
        openings,
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
  }
}
