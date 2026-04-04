import * as OBC from "@thatopen/components";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import type {
  BimElement,
  BimElementType,
  CameraPreset,
  CategoryVisibility,
  CreationTool,
  DEFAULT_PARAMS,
  Dimension3D,
  GridLine,
  GridSize,
  SelectedElement,
  SpatialNode,
  Viewer3DHandle,
  WallAlignMode,
} from "@/types";
import {
  buildBeamMesh,
  buildCeilingMesh,
  buildChairMesh,
  buildColumnMesh,
  buildCurtainWallMesh,
  buildDeskMesh,
  buildDoorMesh,
  buildDuctMesh,
  buildLightFixtureMesh,
  buildMeshForElement,
  buildPipeMesh,
  buildRailingMesh,
  buildRoofMesh,
  buildRoomMesh,
  buildShelvingMesh,
  buildSinkMesh,
  buildSlabMesh,
  buildStairMesh,
  buildTableMesh,
  buildToiletMesh,
  buildWallMesh,
  buildWindowMesh,
  GHOST_MATERIAL,
  getMaterialForElement,
  INVALID_GHOST_MATERIAL,
  SNAP_INDICATOR_MAT,
} from "./geometryBuilders";

// ── Props ──────────────────────────────────────────────────────

interface Viewer3DProps {
  onModelLoaded: (tree: SpatialNode[]) => void;
  onElementSelected: (
    element: SelectedElement | null,
    ctrlKey?: boolean,
  ) => void;
  creationTool: CreationTool;
  onElementCreated: (element: BimElement) => void;
  bimElements: BimElement[];
  selectedElementIds: string[];
  defaultParams: typeof DEFAULT_PARAMS;
  snapEnabled?: boolean;
  gridSize?: GridSize;
  selectedElements?: SelectedElement[];
  gridLines?: GridLine[];
  onGridLineCreated?: (gl: GridLine) => void;
  wallAlignMode?: WallAlignMode;
  cameraPreset?: CameraPreset;
  categoryVisibility?: Record<string, CategoryVisibility>;
  dimensions3D?: Dimension3D[];
  onDimension3DCreated?: (dim: Dimension3D) => void;
  onContextMenu?: (e: React.MouseEvent, elementId: string | null) => void;
}

// ── Helpers ────────────────────────────────────────────────────

function buildGlobalId(mesh: THREE.Mesh): string {
  const gid = mesh.userData.GlobalId ?? mesh.userData.globalId;
  if (typeof gid === "string" && gid.length > 0) return gid;
  const eid = (mesh.userData.expressID as number) ?? mesh.id;
  return `express-${eid}`;
}

function extractProperties(
  mesh: THREE.Mesh,
): Record<string, string | number | boolean> {
  const props: Record<string, string | number | boolean> = {};
  const ud = mesh.userData;
  for (const [key, value] of Object.entries(ud)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      props[key] = value;
    }
  }
  if (mesh.geometry) {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    props["Width (approx)"] = `${size.x.toFixed(2)}m`;
    props["Height (approx)"] = `${size.y.toFixed(2)}m`;
    props["Depth (approx)"] = `${size.z.toFixed(2)}m`;
  }
  props.meshId = mesh.id;
  props.meshName = mesh.name || "(unnamed)";
  return props;
}

// ── Component ──────────────────────────────────────────────────

const Viewer3D = forwardRef<Viewer3DHandle, Viewer3DProps>(function Viewer3D(
  {
    onModelLoaded,
    onElementSelected,
    creationTool,
    onElementCreated,
    bimElements,
    selectedElementIds,
    defaultParams,
    snapEnabled = false,
    gridSize = 0.5,
    selectedElements = [],
    gridLines = [],
    onGridLineCreated,
    wallAlignMode = "center",
    cameraPreset,
    categoryVisibility,
    dimensions3D = [],
    onDimension3DCreated,
    onContextMenu,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<OBC.Components | null>(null);
  const worldRef = useRef<OBC.SimpleWorld<
    OBC.SimpleScene,
    OBC.OrthoPerspectiveCamera,
    OBC.SimpleRenderer
  > | null>(null);
  const modelRef = useRef<unknown>(null);
  const highlightMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const highlightedRef = useRef<THREE.Mesh[]>([]);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());

  // Creation state refs (avoid re-renders during mouse move)
  const creationToolRef = useRef(creationTool);
  creationToolRef.current = creationTool;
  const defaultParamsRef = useRef(defaultParams);
  defaultParamsRef.current = defaultParams;
  const pendingStartRef = useRef<{ x: number; z: number } | null>(null);
  const ghostMeshRef = useRef<THREE.Mesh | null>(null);
  const snapIndicatorRef = useRef<THREE.Mesh | null>(null);
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  /** Cached snap result for door→wall placement */
  const doorSnapRef = useRef<{
    position: { x: number; z: number };
    rotation: number;
    wallId: string;
  } | null>(null);

  /** Map bimElement.id → THREE.Mesh for authored elements */
  const authoredMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  // Snap refs
  const snapEnabledRef = useRef(snapEnabled);
  snapEnabledRef.current = snapEnabled;
  const gridSizeRef = useRef(gridSize);
  gridSizeRef.current = gridSize;

  // Gridline refs
  const gridLinesRef = useRef(gridLines);
  gridLinesRef.current = gridLines;
  const wallAlignModeRef = useRef(wallAlignMode);
  wallAlignModeRef.current = wallAlignMode;
  /** Rendered gridline objects (THREE.Group per gridline) */
  const gridLineObjectsRef = useRef<Map<string, THREE.Group>>(new Map());
  /** Auto-incrementing gridline label counter */
  const gridLineLabelCounterRef = useRef(1);

  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasModel, setHasModel] = useState(false);

  // Box select state
  const boxSelectStartRef = useRef<{ x: number; y: number } | null>(null);
  const [boxSelectRect, setBoxSelectRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const boxSelectThreshold = 5; // min pixels to start box select
  const boxSelectUsedRef = useRef(false);

  // Dimension labels
  const dimensionLabelsRef = useRef<THREE.Sprite[]>([]);

  // ── Scene setup ────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const components = new OBC.Components();
    componentsRef.current = components;

    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<
      OBC.SimpleScene,
      OBC.OrthoPerspectiveCamera,
      OBC.SimpleRenderer
    >();
    worldRef.current = world;

    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBC.SimpleRenderer(components, container);
    world.camera = new OBC.OrthoPerspectiveCamera(components);

    components.init();

    if (cameraPreset) {
      const [px, py, pz] = cameraPreset.position;
      const [tx, ty, tz] = cameraPreset.target;
      world.camera.controls.setLookAt(px, py, pz, tx, ty, tz);

      // Switch to orthographic projection & Plan navigation for 2D views
      if (cameraPreset.orthographic) {
        world.camera.projection.set("Orthographic");
        world.camera.set("Plan");
      }
    } else {
      world.camera.controls.setLookAt(12, 6, 8, 0, 0, -10);
    }
    world.scene.setup();

    const grids = components.get(OBC.Grids);
    const grid = grids.create(world);

    // Disable grid fade for orthographic cameras (looks better)
    if (cameraPreset?.orthographic) {
      grid.fade = false;
    }

    // Set up section clipping plane if preset defines one
    if (cameraPreset?.sectionPlane) {
      const clipper = components.get(OBC.Clipper);
      clipper.enabled = true;
      const { normal, point } = cameraPreset.sectionPlane;
      clipper.createFromNormalAndCoplanarPoint(
        world,
        new THREE.Vector3(normal[0], normal[1], normal[2]),
        new THREE.Vector3(point[0], point[1], point[2]),
      );
      clipper.visible = false; // hide the plane helper
    }

    world.scene.three.background = new THREE.Color(0x0f172a);

    // Add ambient + directional lights for authored geometry
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(10, 20, 10);
    world.scene.three.add(ambient, directional);

    highlightMatRef.current = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });

    // Snap indicator (small sphere on ground)
    const snapGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const snapMesh = new THREE.Mesh(snapGeo, SNAP_INDICATOR_MAT);
    snapMesh.visible = false;
    snapMesh.renderOrder = 1000;
    world.scene.three.add(snapMesh);
    snapIndicatorRef.current = snapMesh;

    return () => {
      components.dispose();
    };
  }, []);

  // ── Highlight helpers ──────────────────────────────────────

  const highlightMeshes = useCallback((meshes: THREE.Mesh[]) => {
    const world = worldRef.current;
    if (!world) return;
    const scene = world.scene.three;
    for (const h of highlightedRef.current) {
      scene.remove(h);
      h.geometry.dispose();
    }
    highlightedRef.current = [];

    const highlightMat = highlightMatRef.current;
    if (!highlightMat) return;

    for (const mesh of meshes) {
      const highlight = new THREE.Mesh(mesh.geometry, highlightMat);
      if (mesh.parent && mesh.parent !== scene) {
        mesh.updateWorldMatrix(true, false);
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        mesh.matrixWorld.decompose(pos, quat, scl);
        highlight.position.copy(pos);
        highlight.quaternion.copy(quat);
        highlight.scale.copy(scl);
      } else {
        highlight.position.copy(mesh.position);
        highlight.rotation.copy(mesh.rotation);
        highlight.scale.copy(mesh.scale);
      }
      highlight.renderOrder = 999;
      scene.add(highlight);
      highlightedRef.current.push(highlight);
    }
  }, []);

  const highlightMesh = useCallback(
    (mesh: THREE.Mesh | null) => {
      highlightMeshes(mesh ? [mesh] : []);
    },
    [highlightMeshes],
  );

  // ── Dimension labels ──────────────────────────────────────

  const clearDimensionLabels = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    for (const sprite of dimensionLabelsRef.current) {
      world.scene.three.remove(sprite);
      (sprite.material as THREE.SpriteMaterial).map?.dispose();
      (sprite.material as THREE.SpriteMaterial).dispose();
    }
    dimensionLabelsRef.current = [];
  }, []);

  const createTextSprite = useCallback(
    (text: string, position: THREE.Vector3): THREE.Sprite => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const fontSize = 28;
      const padding = 8;
      ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      canvas.width = textWidth + padding * 2;
      canvas.height = fontSize + padding * 2;

      // Background
      ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
      ctx.beginPath();
      ctx.roundRect(0, 0, canvas.width, canvas.height, 4);
      ctx.fill();

      // Border
      ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Text
      ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
      ctx.fillStyle = "#93c5fd";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      // Scale sprite to reasonable world-space size
      const aspect = canvas.width / canvas.height;
      sprite.scale.set(aspect * 0.4, 0.4, 1);
      sprite.renderOrder = 1001;
      return sprite;
    },
    [],
  );

  const updateDimensionLabels = useCallback(
    (elementIds: string[]) => {
      clearDimensionLabels();
      const world = worldRef.current;
      if (!world || elementIds.length === 0) return;

      for (const id of elementIds) {
        const el = bimElements.find((e) => e.id === id);
        const mesh = authoredMeshesRef.current.get(id);
        if (!el || !mesh) continue;

        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Build dimension text based on element type
        const labels: { text: string; pos: THREE.Vector3 }[] = [];
        const params = el.params as Record<string, number>;

        if (
          el.type === "wall" ||
          el.type === "beam" ||
          el.type === "duct" ||
          el.type === "pipe" ||
          el.type === "railing" ||
          el.type === "curtainWall"
        ) {
          // Linear elements: show length
          const dx = el.end.x - el.start.x;
          const dz = el.end.z - el.start.z;
          const length = Math.sqrt(dx * dx + dz * dz);
          labels.push({
            text: `L: ${length.toFixed(2)}m`,
            pos: new THREE.Vector3(center.x, box.max.y + 0.3, center.z),
          });
          if (params.height) {
            labels.push({
              text: `H: ${params.height.toFixed(2)}m`,
              pos: new THREE.Vector3(box.max.x + 0.3, center.y, center.z),
            });
          }
        } else if (
          el.type === "slab" ||
          el.type === "ceiling" ||
          el.type === "roof"
        ) {
          // Area elements: show width x depth
          labels.push({
            text: `${size.x.toFixed(2)} x ${size.z.toFixed(2)}m`,
            pos: new THREE.Vector3(center.x, box.max.y + 0.3, center.z),
          });
        } else {
          // Single-click elements: show key dimensions above
          const dimParts: string[] = [];
          if (params.height) dimParts.push(`H:${params.height.toFixed(2)}`);
          if (params.width) dimParts.push(`W:${params.width.toFixed(2)}`);
          if (params.depth) dimParts.push(`D:${params.depth.toFixed(2)}`);
          if (params.radius) dimParts.push(`R:${params.radius.toFixed(2)}`);
          if (params.diameter) dimParts.push(`D:${params.diameter.toFixed(2)}`);
          if (dimParts.length > 0) {
            labels.push({
              text: `${dimParts.join(" ")}m`,
              pos: new THREE.Vector3(center.x, box.max.y + 0.3, center.z),
            });
          }
        }

        for (const label of labels) {
          const sprite = createTextSprite(label.text, label.pos);
          world.scene.three.add(sprite);
          dimensionLabelsRef.current.push(sprite);
        }
      }
    },
    [bimElements, clearDimensionLabels, createTextSprite],
  );

  const flyToMesh = useCallback((mesh: THREE.Mesh) => {
    const world = worldRef.current;
    if (!world) return;

    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);

    world.camera.controls.setLookAt(
      center.x + maxDim * 1.5,
      center.y + maxDim * 0.8,
      center.z + maxDim * 1.5,
      center.x,
      center.y,
      center.z,
      true,
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flyToElement(globalId: string) {
        const mesh =
          meshMapRef.current.get(globalId) ??
          authoredMeshesRef.current.get(globalId);
        if (!mesh) return;
        flyToMesh(mesh);
      },
      flyToLevel(height: number) {
        const world = worldRef.current;
        if (!world) return;
        world.camera.controls.setLookAt(12, height + 8, 12, 0, height, 0, true);
      },
    }),
    [flyToMesh],
  );

  const rebuildMeshMap = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    meshMapRef.current.clear();
    world.scene.three.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const gid = buildGlobalId(obj);
        meshMapRef.current.set(gid, obj);
      }
    });
  }, []);

  // ── Ground plane raycasting ────────────────────────────────

  const raycastGround = useCallback(
    (e: React.MouseEvent): THREE.Vector3 | null => {
      const world = worldRef.current;
      const container = containerRef.current;
      if (!world || !container) return null;

      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), world.camera.three);

      const hit = new THREE.Vector3();
      const didHit = raycaster.ray.intersectPlane(groundPlaneRef.current, hit);
      if (!didHit) return null;

      // Apply gridline snap (higher priority) then grid snap
      if (snapEnabledRef.current) {
        let snappedToGridLine = false;
        const gls = gridLinesRef.current;
        const threshold: number = gridSizeRef.current;

        if (gls.length > 0) {
          let bestDist: number = threshold;
          let bestNx = hit.x;
          let bestNz = hit.z;
          let bestPerpX = 0;
          let bestPerpZ = 0;

          for (const gl of gls) {
            const gdx = gl.end.x - gl.start.x;
            const gdz = gl.end.z - gl.start.z;
            const len2 = gdx * gdx + gdz * gdz;
            if (len2 < 0.0001) continue;
            const len = Math.sqrt(len2);

            // Perpendicular distance from hit to the infinite line
            const vx = hit.x - gl.start.x;
            const vz = hit.z - gl.start.z;
            // Signed cross product gives perpendicular distance
            const cross = vx * (gdz / len) - vz * (gdx / len);
            const dist = Math.abs(cross);

            if (dist < bestDist) {
              bestDist = dist;
              // Project hit onto the line (nearest point)
              const t = (vx * gdx + vz * gdz) / len2;
              bestNx = gl.start.x + t * gdx;
              bestNz = gl.start.z + t * gdz;
              // Perpendicular unit vector (pointing away from line toward hit)
              bestPerpX = -gdz / len;
              bestPerpZ = gdx / len;
              if (cross < 0) {
                bestPerpX = -bestPerpX;
                bestPerpZ = -bestPerpZ;
              }
            }
          }

          if (bestDist < threshold) {
            snappedToGridLine = true;
            // Apply wall alignment offset
            const tool = creationToolRef.current;
            if (tool === "wall") {
              const wallThickness = defaultParamsRef.current.wall.thickness;
              const mode = wallAlignModeRef.current;
              let offset = 0;
              if (mode === "left") offset = wallThickness / 2;
              else if (mode === "right") offset = -wallThickness / 2;
              hit.x = bestNx + bestPerpX * offset;
              hit.z = bestNz + bestPerpZ * offset;
            } else {
              hit.x = bestNx;
              hit.z = bestNz;
            }
          }
        }

        // Fall back to regular grid snap if not snapped to gridline
        if (!snappedToGridLine) {
          const gs = gridSizeRef.current;
          hit.x = Math.round(hit.x / gs) * gs;
          hit.z = Math.round(hit.z / gs) * gs;
        }
      }

      return hit;
    },
    [],
  );

  // ── Wall-snap raycasting for doors ────────────────────────

  const raycastWalls = useCallback(
    (
      e: React.MouseEvent,
    ): {
      position: { x: number; z: number };
      rotation: number;
      wallId: string;
    } | null => {
      const world = worldRef.current;
      const container = containerRef.current;
      if (!world || !container) return null;

      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), world.camera.three);

      // Collect wall meshes from authored elements
      const wallMeshes: THREE.Mesh[] = [];
      authoredMeshesRef.current.forEach((mesh) => {
        if (mesh.userData.type === "WALL") {
          wallMeshes.push(mesh);
        }
      });

      if (wallMeshes.length === 0) return null;

      const intersects = raycaster.intersectObjects(wallMeshes, false);
      if (intersects.length === 0) return null;

      const hit = intersects[0];
      const wallMesh = hit.object as THREE.Mesh;
      const wallId = wallMesh.userData.bimElementId as string;

      // Find the corresponding BimElement to get wall geometry data
      const wallEl = bimElements.find((el) => el.id === wallId);
      if (!wallEl) return null;

      // Compute wall direction and rotation
      const dx = wallEl.end.x - wallEl.start.x;
      const dz = wallEl.end.z - wallEl.start.z;
      const wallRotation = -Math.atan2(dz, dx);
      const wallLength = Math.sqrt(dx * dx + dz * dz);

      // Project the hit point onto the wall's center line
      // Wall direction unit vector
      const dirX = dx / wallLength;
      const dirZ = dz / wallLength;

      // Vector from wall start to hit point
      const hx = hit.point.x - wallEl.start.x;
      const hz = hit.point.z - wallEl.start.z;

      // Project onto wall direction (scalar distance along wall)
      let t = hx * dirX + hz * dirZ;

      // Clamp to keep door within wall bounds (accounting for door width)
      const doorWidth = defaultParamsRef.current.door.width;
      const halfDoor = doorWidth / 2;
      t = Math.max(halfDoor, Math.min(wallLength - halfDoor, t));

      // Position along the wall center line
      const snapX = wallEl.start.x + dirX * t;
      const snapZ = wallEl.start.z + dirZ * t;

      return {
        position: { x: snapX, z: snapZ },
        rotation: wallRotation,
        wallId,
      };
    },
    [bimElements],
  );

  // ── Ghost preview ──────────────────────────────────────────

  const clearGhost = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    if (ghostMeshRef.current) {
      world.scene.three.remove(ghostMeshRef.current);
      ghostMeshRef.current.geometry.dispose();
      ghostMeshRef.current = null;
    }
  }, []);

  const updateGhostPreview = useCallback(
    (groundPoint: THREE.Vector3) => {
      const world = worldRef.current;
      if (!world) return;
      const tool = creationToolRef.current;
      if (tool === "none") return;

      clearGhost();

      const params = defaultParamsRef.current;
      const start = pendingStartRef.current;
      const end = { x: groundPoint.x, z: groundPoint.z };

      let mesh: THREE.Mesh;
      switch (tool) {
        case "wall": {
          const p = params.wall;
          const s = start ?? end;
          mesh = buildWallMesh(
            s,
            end,
            p.height,
            p.thickness,
            0,
            GHOST_MATERIAL,
          );
          break;
        }
        case "column": {
          const p = params.column;
          mesh = buildColumnMesh(end, p.height, p.radius, 0, GHOST_MATERIAL);
          break;
        }
        case "slab": {
          const p = params.slab;
          const s = start ?? end;
          mesh = buildSlabMesh(s, end, p.thickness, 0, GHOST_MATERIAL);
          break;
        }
        case "door": {
          const p = params.door;
          const snap = doorSnapRef.current;
          if (snap) {
            mesh = buildDoorMesh(
              snap.position,
              p.height,
              p.width,
              0,
              GHOST_MATERIAL,
              snap.rotation,
            );
          } else {
            mesh = buildDoorMesh(
              end,
              p.height,
              p.width,
              0,
              INVALID_GHOST_MATERIAL,
            );
          }
          break;
        }
        case "window": {
          const p = params.window;
          const snap = doorSnapRef.current;
          if (snap) {
            mesh = buildWindowMesh(
              snap.position,
              p.height,
              p.width,
              p.sillHeight,
              0,
              GHOST_MATERIAL,
              snap.rotation,
            );
          } else {
            mesh = buildWindowMesh(
              end,
              p.height,
              p.width,
              p.sillHeight,
              0,
              INVALID_GHOST_MATERIAL,
            );
          }
          break;
        }
        case "beam": {
          const p = params.beam;
          const s = start ?? end;
          mesh = buildBeamMesh(s, end, p.height, p.width, 0, GHOST_MATERIAL);
          break;
        }
        case "ceiling": {
          const p = params.ceiling;
          const s = start ?? end;
          mesh = buildCeilingMesh(s, end, p.thickness, 3, GHOST_MATERIAL);
          break;
        }
        case "roof": {
          const p = params.roof;
          const s = start ?? end;
          mesh = buildRoofMesh(
            s,
            end,
            p.height,
            p.thickness,
            p.overhang,
            3,
            GHOST_MATERIAL,
          );
          break;
        }
        case "stair": {
          const p = params.stair;
          const s = start ?? end;
          mesh = buildStairMesh(
            s,
            end,
            p.riserHeight,
            p.treadDepth,
            p.width,
            p.numRisers,
            0,
            GHOST_MATERIAL,
          );
          break;
        }
        case "railing": {
          const p = params.railing;
          const s = start ?? end;
          mesh = buildRailingMesh(
            s,
            end,
            p.height,
            p.postSpacing,
            0,
            GHOST_MATERIAL,
          );
          break;
        }
        case "curtainWall": {
          const p = params.curtainWall;
          const s = start ?? end;
          mesh = buildCurtainWallMesh(
            s,
            end,
            p.height,
            p.panelWidth,
            p.panelHeight,
            p.mullionSize,
            0,
            GHOST_MATERIAL,
          );
          break;
        }
        case "table": {
          const p = params.table;
          mesh = buildTableMesh(
            end,
            p.height,
            p.width,
            p.depth,
            0,
            GHOST_MATERIAL,
          );
          break;
        }
        case "chair": {
          const p = params.chair;
          mesh = buildChairMesh(
            end,
            p.height,
            p.width,
            p.depth,
            0,
            GHOST_MATERIAL,
          );
          break;
        }
        case "shelving": {
          const p = params.shelving;
          mesh = buildShelvingMesh(
            end,
            p.height,
            p.width,
            p.depth,
            0,
            GHOST_MATERIAL,
          );
          break;
        }
        case "desk": {
          const p = params.desk;
          mesh = buildDeskMesh(
            end,
            p.height,
            p.width,
            p.depth,
            p.lShaped,
            0,
            GHOST_MATERIAL,
          );
          break;
        }
        case "toilet": {
          const p = params.toilet;
          mesh = buildToiletMesh(
            end,
            p.height,
            p.width,
            p.depth,
            0,
            GHOST_MATERIAL,
          );
          break;
        }
        case "sink": {
          const p = params.sink;
          mesh = buildSinkMesh(
            end,
            p.height,
            p.width,
            p.depth,
            0,
            GHOST_MATERIAL,
          );
          break;
        }
        case "duct": {
          const p = params.duct;
          const s = start ?? end;
          mesh = buildDuctMesh(s, end, p.height, p.width, 0, GHOST_MATERIAL);
          break;
        }
        case "pipe": {
          const p = params.pipe;
          const s = start ?? end;
          mesh = buildPipeMesh(s, end, p.diameter, 0, GHOST_MATERIAL);
          break;
        }
        case "lightFixture": {
          const p = params.lightFixture;
          mesh = buildLightFixtureMesh(
            end,
            p.width,
            p.depth,
            3,
            GHOST_MATERIAL,
          );
          break;
        }
        case "room": {
          const p = params.room;
          const s = start ?? end;
          mesh = buildRoomMesh(s, end, p.height, 0, GHOST_MATERIAL);
          break;
        }
        case "dimension3d": {
          // Ghost line from start to cursor for 3D dimension
          const s = start ?? end;
          const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(s.x, 0.05, s.z),
            new THREE.Vector3(end.x, 0.05, end.z),
          ]);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0xfbbf24,
            transparent: true,
            opacity: 0.8,
          });
          const lineObj = new THREE.Line(lineGeo, lineMat);
          const dummyGeo = new THREE.SphereGeometry(0.05);
          mesh = new THREE.Mesh(dummyGeo, GHOST_MATERIAL);
          mesh.position.set(end.x, 0.05, end.z);
          mesh.add(lineObj);
          break;
        }
        case "gridline": {
          // Ghost line from start to cursor
          const s = start ?? end;
          const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(s.x, 0.02, s.z),
            new THREE.Vector3(end.x, 0.02, end.z),
          ]);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0x06b6d4,
            transparent: true,
            opacity: 0.6,
          });
          // THREE.Line extends Object3D, not Mesh — wrap in a mesh-like group
          const lineObj = new THREE.Line(lineGeo, lineMat);
          // Use a tiny invisible mesh to satisfy the ghostMeshRef type
          const dummyGeo = new THREE.SphereGeometry(0.05);
          mesh = new THREE.Mesh(dummyGeo, GHOST_MATERIAL);
          mesh.position.set(end.x, 0.02, end.z);
          mesh.add(lineObj);
          break;
        }
        default:
          return;
      }

      mesh.renderOrder = 998;
      world.scene.three.add(mesh);
      ghostMeshRef.current = mesh;
    },
    [clearGhost],
  );

  // ── Ortho constraint (Shift = axis-lock) ───────────────────

  /** When Shift is held and a start point exists, constrain the hit to
   *  the nearest axis (horizontal or vertical) relative to the start. */
  const applyOrthoConstraint = useCallback(
    (hit: THREE.Vector3, shiftKey: boolean): void => {
      const start = pendingStartRef.current;
      if (!start || !shiftKey) return;
      const adx = Math.abs(hit.x - start.x);
      const adz = Math.abs(hit.z - start.z);
      if (adx >= adz) {
        // Constrain to horizontal (same Z as start)
        hit.z = start.z;
      } else {
        // Constrain to vertical (same X as start)
        hit.x = start.x;
      }
    },
    [],
  );

  // ── Mouse move for ghost + snap indicator ──────────────────

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const tool = creationToolRef.current;
      if (tool === "none") {
        if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
        clearGhost();
        doorSnapRef.current = null;
        handleMouseMoveBoxSelect(e);
        return;
      }

      const hit = raycastGround(e);
      if (!hit) return;

      // Ortho constraint: Shift locks to horizontal or vertical
      applyOrthoConstraint(hit, e.shiftKey);

      // For gridline or dimension3d tool, just show snap indicator and ghost (no wall snap)
      if (tool === "gridline" || tool === "dimension3d") {
        if (snapIndicatorRef.current) {
          snapIndicatorRef.current.position.set(hit.x, 0.02, hit.z);
          snapIndicatorRef.current.visible = true;
        }
        updateGhostPreview(hit);
        return;
      }

      // For doors and windows, try snapping to a wall first
      if (tool === "door" || tool === "window") {
        const wallSnap = raycastWalls(e);
        doorSnapRef.current = wallSnap;

        if (wallSnap && snapIndicatorRef.current) {
          // Show snap indicator on the wall
          snapIndicatorRef.current.position.set(
            wallSnap.position.x,
            0.01,
            wallSnap.position.z,
          );
          snapIndicatorRef.current.visible = true;
        } else if (snapIndicatorRef.current) {
          snapIndicatorRef.current.position.set(hit.x, 0.01, hit.z);
          snapIndicatorRef.current.visible = true;
        }
      } else {
        doorSnapRef.current = null;
        // Snap indicator for non-door tools
        if (snapIndicatorRef.current) {
          snapIndicatorRef.current.position.set(hit.x, 0.01, hit.z);
          snapIndicatorRef.current.visible = true;
        }
      }

      updateGhostPreview(hit);
    },
    [
      raycastGround,
      raycastWalls,
      updateGhostPreview,
      clearGhost,
      applyOrthoConstraint,
    ],
  );

  // ── Box select handlers ─────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (creationToolRef.current !== "none") return;
    if (e.button !== 0) return; // left button only
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    boxSelectStartRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseMoveBoxSelect = useCallback((e: React.MouseEvent) => {
    const start = boxSelectStartRef.current;
    if (!start) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dx = Math.abs(cx - start.x);
    const dy = Math.abs(cy - start.y);
    if (dx > boxSelectThreshold || dy > boxSelectThreshold) {
      setBoxSelectRect({
        x: Math.min(start.x, cx),
        y: Math.min(start.y, cy),
        width: Math.abs(cx - start.x),
        height: Math.abs(cy - start.y),
      });
    }
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const start = boxSelectStartRef.current;
      boxSelectStartRef.current = null;

      if (!boxSelectRect) return;
      setBoxSelectRect(null);
      boxSelectUsedRef.current = true;

      // Box select: find all authored elements whose center projects inside the box
      const world = worldRef.current;
      const container = containerRef.current;
      if (!world || !container || !start) return;

      const rect = container.getBoundingClientRect();
      const camera = world.camera.three;
      const w = rect.width;
      const h = rect.height;

      // Normalized box bounds (-1 to 1)
      const bx = boxSelectRect.x;
      const by = boxSelectRect.y;
      const bw = boxSelectRect.width;
      const bh = boxSelectRect.height;

      const selected: SelectedElement[] = [];
      for (const [id, mesh] of Array.from(
        authoredMeshesRef.current.entries(),
      )) {
        const pos = new THREE.Vector3();
        mesh.getWorldPosition(pos);
        pos.project(camera);
        // Convert to pixel coordinates
        const sx = (pos.x * 0.5 + 0.5) * w;
        const sy = (-pos.y * 0.5 + 0.5) * h;
        if (sx >= bx && sx <= bx + bw && sy >= by && sy <= by + bh) {
          selected.push({
            expressID: 0,
            globalId: id,
            type: (mesh.userData.type as string) || mesh.name || "Element",
            name: mesh.name || `Element #${mesh.id}`,
            properties: extractProperties(mesh),
          });
        }
      }

      if (selected.length > 0) {
        // Select the last one as primary, but also set all via onElementSelected
        const ctrlKey = e.ctrlKey || e.metaKey;
        // For box select, we report each element to build the full selection
        // We use a batch approach: first element resets (unless ctrl), rest add
        for (let i = 0; i < selected.length; i++) {
          onElementSelected(selected[i], ctrlKey || i > 0);
        }
      } else if (!e.ctrlKey && !e.metaKey) {
        onElementSelected(null);
      }
    },
    [boxSelectRect, onElementSelected],
  );

  // ── Sync authored BimElements → scene ──────────────────────

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const scene = world.scene.three;

    // Remove stale meshes
    const currentIds = new Set(bimElements.map((el) => el.id));
    for (const [id, mesh] of Array.from(authoredMeshesRef.current.entries())) {
      if (!currentIds.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        authoredMeshesRef.current.delete(id);
      }
    }

    // Add or update meshes
    for (const el of bimElements) {
      const existing = authoredMeshesRef.current.get(el.id);
      if (existing) {
        // Remove old, rebuild (simple approach for param changes)
        scene.remove(existing);
        existing.geometry.dispose();
      }

      const material = getMaterialForElement(el);
      const mesh = buildMeshForElement(el, material, bimElements);
      mesh.name = el.name;
      mesh.userData = {
        bimElementId: el.id,
        type: el.type.toUpperCase(),
        globalId: el.id,
        expressID: 0,
        ...el.params,
      };
      scene.add(mesh);
      authoredMeshesRef.current.set(el.id, mesh);
    }
  }, [bimElements]);

  // ── Sync gridlines → scene ─────────────────────────────────

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const scene = world.scene.three;

    // Remove stale gridline objects
    const currentGlIds = new Set(gridLines.map((gl) => gl.id));
    for (const [id, group] of Array.from(
      gridLineObjectsRef.current.entries(),
    )) {
      if (!currentGlIds.has(id)) {
        scene.remove(group);
        group.traverse((obj) => {
          if (obj instanceof THREE.Line) obj.geometry.dispose();
          if (obj instanceof THREE.Sprite) {
            (obj.material as THREE.SpriteMaterial).map?.dispose();
            (obj.material as THREE.SpriteMaterial).dispose();
          }
        });
        gridLineObjectsRef.current.delete(id);
      }
    }

    // Add or update gridlines
    const GRIDLINE_COLOR = 0x06b6d4; // cyan
    const EXTEND = 50; // extend line 50m beyond each end

    for (const gl of gridLines) {
      // Remove existing to rebuild
      const existing = gridLineObjectsRef.current.get(gl.id);
      if (existing) {
        scene.remove(existing);
        existing.traverse((obj) => {
          if (obj instanceof THREE.Line) obj.geometry.dispose();
          if (obj instanceof THREE.Sprite) {
            (obj.material as THREE.SpriteMaterial).map?.dispose();
            (obj.material as THREE.SpriteMaterial).dispose();
          }
        });
      }

      const group = new THREE.Group();
      group.userData = { gridLineId: gl.id };

      // Compute direction and extend the line
      const dx = gl.end.x - gl.start.x;
      const dz = gl.end.z - gl.start.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.01) continue;
      const dirX = dx / len;
      const dirZ = dz / len;

      const extStart = new THREE.Vector3(
        gl.start.x - dirX * EXTEND,
        0.02,
        gl.start.z - dirZ * EXTEND,
      );
      const extEnd = new THREE.Vector3(
        gl.end.x + dirX * EXTEND,
        0.02,
        gl.end.z + dirZ * EXTEND,
      );

      // Dashed line
      const lineMat = new THREE.LineDashedMaterial({
        color: GRIDLINE_COLOR,
        dashSize: 0.5,
        gapSize: 0.2,
        linewidth: 1,
      });
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        extStart,
        extEnd,
      ]);
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      group.add(line);

      // Bubble at start end
      const bubbleGeo = new THREE.CircleGeometry(0.4, 24);
      const bubbleMat = new THREE.MeshBasicMaterial({
        color: GRIDLINE_COLOR,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
      bubble.position.set(gl.start.x, 0.03, gl.start.z);
      bubble.rotation.x = -Math.PI / 2;
      bubble.renderOrder = 1002;
      group.add(bubble);

      // Label sprite at start
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const fontSize = 32;
      ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
      const tw = ctx.measureText(gl.label).width;
      canvas.width = Math.max(tw + 16, 48);
      canvas.height = fontSize + 16;
      ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(gl.label, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(gl.start.x, 0.04, gl.start.z);
      const aspect = canvas.width / canvas.height;
      sprite.scale.set(aspect * 0.5, 0.5, 1);
      sprite.renderOrder = 1003;
      group.add(sprite);

      scene.add(group);
      gridLineObjectsRef.current.set(gl.id, group);
    }

    // Update label counter
    if (gridLines.length > 0) {
      gridLineLabelCounterRef.current = gridLines.length + 1;
    }
  }, [gridLines]);

  // ── Sync 3D dimension lines → scene ────────────────────────

  const dimension3DObjectsRef = useRef<Map<string, THREE.Group>>(new Map());

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const scene = world.scene.three;

    // Remove stale
    const currentIds = new Set(dimensions3D.map((d) => d.id));
    for (const [id, group] of Array.from(
      dimension3DObjectsRef.current.entries(),
    )) {
      if (!currentIds.has(id)) {
        scene.remove(group);
        group.traverse((obj) => {
          if (obj instanceof THREE.Line) obj.geometry.dispose();
          if (obj instanceof THREE.Sprite) {
            (obj.material as THREE.SpriteMaterial).map?.dispose();
            (obj.material as THREE.SpriteMaterial).dispose();
          }
        });
        dimension3DObjectsRef.current.delete(id);
      }
    }

    for (const dim of dimensions3D) {
      if (dimension3DObjectsRef.current.has(dim.id)) continue;

      const group = new THREE.Group();

      // Main line
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(dim.start.x, 0.05, dim.start.z),
        new THREE.Vector3(dim.end.x, 0.05, dim.end.z),
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xfbbf24,
        linewidth: 2,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      group.add(line);

      // Extension lines (vertical ticks at endpoints)
      const tickLen = 0.3;
      for (const pt of [dim.start, dim.end]) {
        const tickGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(pt.x, -tickLen, pt.z),
          new THREE.Vector3(pt.x, tickLen, pt.z),
        ]);
        const tick = new THREE.Line(
          tickGeo,
          new THREE.LineBasicMaterial({ color: 0xfbbf24 }),
        );
        group.add(tick);
      }

      // Distance label at midpoint
      const mx = (dim.start.x + dim.end.x) / 2;
      const mz = (dim.start.z + dim.end.z) / 2;
      const label = `${dim.distance.toFixed(2)}m`;
      const sprite = createTextSprite(label, new THREE.Vector3(mx, 0.5, mz));
      group.add(sprite);

      scene.add(group);
      dimension3DObjectsRef.current.set(dim.id, group);
    }
  }, [dimensions3D, createTextSprite]);

  // ── Visibility / Graphics filtering ───────────────────────

  const categoryVisibilityRef = useRef(categoryVisibility);
  categoryVisibilityRef.current = categoryVisibility;

  useEffect(() => {
    if (!categoryVisibility) return;
    for (const [id, mesh] of Array.from(authoredMeshesRef.current.entries())) {
      const el = bimElements.find((e) => e.id === id);
      if (!el) continue;
      const vis = categoryVisibility[el.type];
      if (vis) {
        mesh.visible = vis.visible;
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.wireframe = vis.wireframe;
          mesh.material.opacity = vis.visible ? 1 - vis.transparency : 0;
          mesh.material.transparent = vis.transparency > 0 || !vis.visible;
        }
      }
    }
  }, [categoryVisibility, bimElements]);

  // ── Click handler ──────────────────────────────────────────

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Skip if box select just completed
      if (boxSelectUsedRef.current) {
        boxSelectUsedRef.current = false;
        return;
      }

      const world = worldRef.current;
      if (!world) return;

      const tool = creationToolRef.current;

      // ── Creation mode ──
      if (tool !== "none") {
        const hit = raycastGround(e);
        if (!hit) return;

        // Ortho constraint: Shift locks to horizontal or vertical
        applyOrthoConstraint(hit, e.shiftKey);

        const point = { x: hit.x, z: hit.z };
        const params = defaultParamsRef.current;
        // Gridline creation (two-click, not a BIM element)
        if (tool === "gridline") {
          if (!pendingStartRef.current) {
            pendingStartRef.current = point;
            return;
          }
          const glStart = pendingStartRef.current;
          pendingStartRef.current = null;
          clearGhost();

          const label = String(gridLineLabelCounterRef.current++);
          const gl: GridLine = {
            id: crypto.randomUUID(),
            label,
            start: glStart,
            end: point,
          };
          onGridLineCreated?.(gl);
          return;
        }

        // Dimension3D creation (two-click, not a BIM element)
        if (tool === "dimension3d") {
          if (!pendingStartRef.current) {
            pendingStartRef.current = point;
            return;
          }
          const dimStart = pendingStartRef.current;
          pendingStartRef.current = null;
          clearGhost();

          const dx = point.x - dimStart.x;
          const dz = point.z - dimStart.z;
          const distance = Math.sqrt(dx * dx + dz * dz);
          const dim: Dimension3D = {
            id: crypto.randomUUID(),
            start: { x: dimStart.x, y: 0, z: dimStart.z },
            end: { x: point.x, y: 0, z: point.z },
            distance,
          };
          onDimension3DCreated?.(dim);
          return;
        }

        const needsTwoClicks =
          tool === "wall" ||
          tool === "slab" ||
          tool === "beam" ||
          tool === "ceiling" ||
          tool === "roof" ||
          tool === "stair" ||
          tool === "railing" ||
          tool === "curtainWall" ||
          tool === "duct" ||
          tool === "pipe" ||
          tool === "room";

        if (needsTwoClicks) {
          if (!pendingStartRef.current) {
            // First click — set start
            pendingStartRef.current = point;
            return;
          }
          // Second click — complete
          const start = pendingStartRef.current;
          pendingStartRef.current = null;
          clearGhost();

          const el: BimElement = {
            id: crypto.randomUUID(),
            type: tool,
            name: `${tool.charAt(0).toUpperCase() + tool.slice(1)} ${Date.now().toString(36).slice(-4).toUpperCase()}`,
            start,
            end: point,
            params: { ...params[tool] },
            // Ceiling/roof at room height (3m); beam at wall height
            level:
              tool === "ceiling" || tool === "roof"
                ? 3
                : tool === "beam"
                  ? 2.6
                  : 0,
          };
          onElementCreated(el);
        } else if (tool === "door" || tool === "window") {
          // Door/Window — must snap to a wall
          const wallSnap = raycastWalls(e);
          if (!wallSnap) return;

          clearGhost();
          doorSnapRef.current = null;

          const el: BimElement = {
            id: crypto.randomUUID(),
            type: tool,
            name: `${tool.charAt(0).toUpperCase() + tool.slice(1)} ${Date.now().toString(36).slice(-4).toUpperCase()}`,
            start: wallSnap.position,
            end: wallSnap.position,
            params: { ...params[tool] },
            level: 0,
            rotation: wallSnap.rotation,
            hostWallId: wallSnap.wallId,
          };
          onElementCreated(el);
        } else {
          // Single-click elements (column, table, chair, shelving)
          clearGhost();

          const el: BimElement = {
            id: crypto.randomUUID(),
            type: tool,
            name: `${tool.charAt(0).toUpperCase() + tool.slice(1)} ${Date.now().toString(36).slice(-4).toUpperCase()}`,
            start: point,
            end: point,
            params: { ...params[tool] },
            level: 0,
          };
          onElementCreated(el);
        }
        return;
      }

      // ── Selection mode ──
      if (!modelRef.current && authoredMeshesRef.current.size === 0) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), world.camera.three);

      const meshes: THREE.Mesh[] = [];
      world.scene.three.traverse((obj) => {
        if (obj instanceof THREE.Mesh) meshes.push(obj);
      });

      const intersects = raycaster.intersectObjects(meshes, false);

      if (intersects.length > 0) {
        // Prefer doors/windows over their host wall when both are hit
        // at a similar distance (door is inside the wall geometry).
        let bestIdx = 0;
        const bestDist = intersects[0].distance;
        for (let i = 1; i < intersects.length; i++) {
          const hit = intersects[i];
          if (hit.distance - bestDist > 0.3) break;
          const type = (hit.object as THREE.Mesh).userData.type as
            | string
            | undefined;
          if (type === "DOOR" || type === "WINDOW") {
            bestIdx = i;
            break;
          }
        }
        const mesh = intersects[bestIdx].object as THREE.Mesh;

        const globalId =
          (mesh.userData.bimElementId as string) || buildGlobalId(mesh);
        const element: SelectedElement = {
          expressID: (mesh.userData.expressID as number) || 0,
          globalId,
          type: (mesh.userData.type as string) || mesh.name || "Element",
          name: mesh.name || `Element #${mesh.id}`,
          properties: extractProperties(mesh),
        };
        onElementSelected(element, e.ctrlKey || e.metaKey);
      } else {
        onElementSelected(null);
      }
    },
    [
      onElementSelected,
      onElementCreated,
      raycastGround,
      raycastWalls,
      clearGhost,
      applyOrthoConstraint,
    ],
  );

  // ── Sync multi-select highlights + dimension labels ─────────

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedElementIds triggers highlight sync
  useEffect(() => {
    const meshes: THREE.Mesh[] = [];
    for (const id of selectedElementIds) {
      const mesh =
        authoredMeshesRef.current.get(id) ?? meshMapRef.current.get(id);
      if (mesh) meshes.push(mesh);
    }
    highlightMeshes(meshes);
    updateDimensionLabels(selectedElementIds);
  }, [selectedElementIds, bimElements, highlightMeshes, updateDimensionLabels]);

  // ── Clear pending start when tool changes ──────────────────

  // biome-ignore lint/correctness/useExhaustiveDependencies: creationTool triggers reset intentionally
  useEffect(() => {
    pendingStartRef.current = null;
    clearGhost();
  }, [creationTool, clearGhost]);

  // ── IFC loading ────────────────────────────────────────────

  const loadIfc = useCallback(
    async (file: File) => {
      const components = componentsRef.current;
      const world = worldRef.current;
      if (!components || !world) return;

      setLoading(true);

      try {
        const fragments = components.get(OBC.FragmentsManager);
        if (!fragments.initialized) {
          const workerUrl = new URL(
            "@thatopen/fragments/worker",
            import.meta.url,
          );
          await fragments.init(workerUrl.href);
        }

        const ifcLoader = components.get(OBC.IfcLoader);
        await ifcLoader.setup();

        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        const model = await ifcLoader.load(data, true, file.name);
        modelRef.current = model;

        try {
          const boxes = await model.getBoxes();
          if (boxes && boxes.length > 0) {
            const merged = new THREE.Box3();
            for (const b of boxes) merged.union(b);
            const center = merged.getCenter(new THREE.Vector3());
            const size = merged.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            world.camera.controls.setLookAt(
              center.x + maxDim,
              center.y + maxDim * 0.75,
              center.z + maxDim,
              center.x,
              center.y,
              center.z,
            );
          }
        } catch {
          world.camera.controls.setLookAt(20, 15, 20, 0, 0, 0);
        }

        rebuildMeshMap();

        const tree = await buildSpatialTree(model);
        onModelLoaded(tree);
        setHasModel(true);
      } catch (err) {
        console.error("Failed to load IFC file:", err);
        alert("Failed to load IFC file. Check console for details.");
      } finally {
        setLoading(false);
      }
    },
    [onModelLoaded, rebuildMeshMap],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.name.toLowerCase().endsWith(".ifc")) {
        loadIfc(file);
      }
    },
    [loadIfc],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadIfc(file);
    },
    [loadIfc],
  );

  // ── Cursor style ───────────────────────────────────────────

  const cursorStyle = creationTool !== "none" ? "crosshair" : "default";

  return (
    <div
      ref={containerRef}
      role="application"
      className="relative flex-1 h-full"
      style={{ cursor: cursorStyle }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        const container = containerRef.current;
        const world = worldRef.current;
        if (!container || !world) return;
        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), world.camera.three);
        const meshes: THREE.Mesh[] = [];
        world.scene.three.traverse((obj) => {
          if (obj instanceof THREE.Mesh) meshes.push(obj);
        });
        const intersects = raycaster.intersectObjects(meshes, false);
        if (intersects.length > 0) {
          const mesh = intersects[0].object as THREE.Mesh;
          const id = (mesh.userData.bimElementId as string) || null;
          onContextMenu(e, id);
        } else {
          onContextMenu(e, null);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          pendingStartRef.current = null;
          clearGhost();
          boxSelectStartRef.current = null;
          setBoxSelectRect(null);
          onElementSelected(null);
        }
      }}
    >
      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-500/20 border-2 border-dashed border-blue-400 pointer-events-none">
          <p className="text-blue-300 text-xl font-semibold">
            Drop .ifc file here
          </p>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-300 text-sm">Loading IFC model...</p>
          </div>
        </div>
      )}

      {/* Creation mode hint */}
      {creationTool !== "none" && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-lg bg-green-900/80 border border-green-700 text-green-300 text-xs backdrop-blur-sm">
          {creationTool === "gridline" ? (
            pendingStartRef.current ? (
              <span>
                Click to set gridline end point &middot; Shift = ortho &middot;
                Esc to cancel
              </span>
            ) : (
              <span>Click to set gridline start point</span>
            )
          ) : creationTool === "dimension3d" ? (
            pendingStartRef.current ? (
              <span>
                Click to set dimension end point &middot; Esc to cancel
              </span>
            ) : (
              <span>Click to set dimension start point</span>
            )
          ) : creationTool === "wall" ||
            creationTool === "slab" ||
            creationTool === "beam" ||
            creationTool === "ceiling" ||
            creationTool === "roof" ||
            creationTool === "stair" ||
            creationTool === "railing" ||
            creationTool === "curtainWall" ||
            creationTool === "duct" ||
            creationTool === "pipe" ||
            creationTool === "room" ? (
            pendingStartRef.current ? (
              <span>
                Click to set end point &middot; Shift = ortho &middot; Esc to
                cancel
                {creationTool === "wall" && gridLines.length > 0
                  ? ` · Tab = Align (${wallAlignMode})`
                  : ""}
              </span>
            ) : (
              <span>
                Click to set start point
                {creationTool === "wall" && gridLines.length > 0
                  ? ` · Tab = Align (${wallAlignMode})`
                  : ""}
              </span>
            )
          ) : creationTool === "door" || creationTool === "window" ? (
            <span>Hover over a wall and click to place {creationTool}</span>
          ) : (
            <span>Click to place {creationTool}</span>
          )}
        </div>
      )}

      {/* Box select rectangle overlay */}
      {boxSelectRect && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left: boxSelectRect.x,
            top: boxSelectRect.y,
            width: boxSelectRect.width,
            height: boxSelectRect.height,
            border: "1px dashed rgba(59, 130, 246, 0.8)",
            background: "rgba(59, 130, 246, 0.1)",
          }}
        />
      )}

      {!hasModel && !loading && bimElements.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-center pointer-events-auto">
            <p className="text-slate-400 text-lg mb-2">
              Drag & drop an .ifc file here
            </p>
            <p className="text-slate-500 text-sm mb-4">
              or use the Create toolbar to start building
            </p>
            <label className="cursor-pointer inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm">
              Or browse files
              <input
                type="file"
                accept=".ifc"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
});

export default Viewer3D;

// ── Spatial tree builders ────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: FragmentsModel API is loosely typed
async function buildSpatialTree(model: any): Promise<SpatialNode[]> {
  try {
    if (typeof model.getSpatialStructure === "function") {
      const structure = await model.getSpatialStructure();
      if (structure) {
        return parseSpatialStructure(structure);
      }
    }
  } catch (e) {
    console.warn("getSpatialStructure failed:", e);
  }

  try {
    if (typeof model.getCategories === "function") {
      const categories = await model.getCategories();
      if (categories) {
        return parseCategoriesAsTree(categories);
      }
    }
  } catch (e) {
    console.warn("getCategories fallback failed:", e);
  }

  return [];
}

// biome-ignore lint/suspicious/noExplicitAny: spatial structure shape varies by IFC version
function parseSpatialStructure(structure: any): SpatialNode[] {
  if (!structure) return [];

  const nodes: SpatialNode[] = [];

  function walk(
    item: Record<string, unknown>,
    parentType?: string,
  ): SpatialNode {
    const type = (item.type as string) || parentType || "Unknown";
    const name = (item.name as string) || (item.Name as string) || type;
    const expressID =
      (item.expressID as number) || (item.localId as number) || 0;
    const children: SpatialNode[] = [];

    const childItems =
      (item.children as Record<string, unknown>[]) ||
      (item.decomposedBy as Record<string, unknown>[]) ||
      [];

    for (const child of childItems) {
      children.push(walk(child));
    }

    return { expressID, type, name, children };
  }

  if (Array.isArray(structure)) {
    for (const item of structure) {
      nodes.push(walk(item));
    }
  } else {
    nodes.push(walk(structure));
  }

  return nodes;
}

function parseCategoriesAsTree(
  categories: Record<string, number[]>,
): SpatialNode[] {
  return Object.entries(categories).map(([category, ids]) => ({
    expressID: 0,
    type: category,
    name: category
      .replace("IFC", "")
      .replace(/([A-Z])/g, " $1")
      .trim(),
    children: ids.map((id) => ({
      expressID: id,
      type: category,
      name: `${category} #${id}`,
      children: [],
    })),
  }));
}
