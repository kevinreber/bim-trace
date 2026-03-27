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
  CreationTool,
  SelectedElement,
  SpatialNode,
  Viewer3DHandle,
} from "@/types";
import { DEFAULT_PARAMS } from "@/types";

// ── Props ──────────────────────────────────────────────────────

interface Viewer3DProps {
  onModelLoaded: (tree: SpatialNode[]) => void;
  onElementSelected: (element: SelectedElement | null) => void;
  creationTool: CreationTool;
  onElementCreated: (element: BimElement) => void;
  bimElements: BimElement[];
  defaultParams: typeof DEFAULT_PARAMS;
}

// ── Materials ──────────────────────────────────────────────────

const ELEMENT_MATERIALS: Record<BimElementType, THREE.MeshStandardMaterial> = {
  wall: new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.9 }),
  column: new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.6 }),
  slab: new THREE.MeshStandardMaterial({ color: 0xbab5ab, roughness: 0.85 }),
  door: new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.7 }),
};

const GHOST_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x4ade80,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
});

const SNAP_INDICATOR_MAT = new THREE.MeshBasicMaterial({
  color: 0x4ade80,
  depthTest: false,
});

// ── Geometry builders ──────────────────────────────────────────

function buildWallMesh(
  start: { x: number; z: number },
  end: { x: number; z: number },
  height: number,
  thickness: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.01) return new THREE.Mesh();

  const geo = new THREE.BoxGeometry(length, height, thickness);
  const mesh = new THREE.Mesh(geo, material);

  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;
  mesh.position.set(cx, level + height / 2, cz);
  mesh.rotation.y = -Math.atan2(dz, dx);

  return mesh;
}

function buildColumnMesh(
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

function buildSlabMesh(
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

function buildDoorMesh(
  pos: { x: number; z: number },
  height: number,
  width: number,
  level: number,
  material: THREE.Material,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, height, 0.08);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos.x, level + height / 2, pos.z);
  return mesh;
}

function buildMeshForElement(
  el: BimElement,
  material: THREE.Material,
): THREE.Mesh {
  switch (el.type) {
    case "wall": {
      const p = el.params as { height: number; thickness: number };
      return buildWallMesh(
        el.start,
        el.end,
        p.height,
        p.thickness,
        el.level,
        material,
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
      return buildDoorMesh(el.start, p.height, p.width, el.level, material);
    }
  }
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
    defaultParams,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<OBC.Components | null>(null);
  const worldRef = useRef<OBC.SimpleWorld<
    OBC.SimpleScene,
    OBC.SimpleCamera,
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

  /** Map bimElement.id → THREE.Mesh for authored elements */
  const authoredMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasModel, setHasModel] = useState(false);

  // ── Scene setup ────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const components = new OBC.Components();
    componentsRef.current = components;

    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<
      OBC.SimpleScene,
      OBC.SimpleCamera,
      OBC.SimpleRenderer
    >();
    worldRef.current = world;

    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBC.SimpleRenderer(components, container);
    world.camera = new OBC.SimpleCamera(components);

    components.init();

    world.camera.controls.setLookAt(12, 6, 8, 0, 0, -10);
    world.scene.setup();

    const grids = components.get(OBC.Grids);
    grids.create(world);

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

  const highlightMesh = useCallback((mesh: THREE.Mesh | null) => {
    const world = worldRef.current;
    if (!world) return;
    const scene = world.scene.three;

    for (const h of highlightedRef.current) {
      scene.remove(h);
      h.geometry.dispose();
    }
    highlightedRef.current = [];

    if (!mesh) return;

    const highlightMat = highlightMatRef.current;
    if (highlightMat) {
      const highlight = new THREE.Mesh(mesh.geometry, highlightMat);
      highlight.position.copy(mesh.position);
      highlight.rotation.copy(mesh.rotation);
      highlight.scale.copy(mesh.scale);
      highlight.renderOrder = 999;
      if (mesh.parent) {
        highlight.applyMatrix4(mesh.matrixWorld);
      }
      scene.add(highlight);
      highlightedRef.current.push(highlight);
    }
  }, []);

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
        highlightMesh(mesh);
        flyToMesh(mesh);

        const element: SelectedElement = {
          expressID: (mesh.userData.expressID as number) || 0,
          globalId,
          type: (mesh.userData.type as string) || mesh.name || "Element",
          name: mesh.name || `Element #${mesh.id}`,
          properties: extractProperties(mesh),
        };
        onElementSelected(element);
      },
    }),
    [highlightMesh, flyToMesh, onElementSelected],
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
      return didHit ? hit : null;
    },
    [],
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
          mesh = buildDoorMesh(end, p.height, p.width, 0, GHOST_MATERIAL);
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

  // ── Mouse move for ghost + snap indicator ──────────────────

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const tool = creationToolRef.current;
      if (tool === "none") {
        if (snapIndicatorRef.current) snapIndicatorRef.current.visible = false;
        clearGhost();
        return;
      }

      const hit = raycastGround(e);
      if (!hit) return;

      // Snap indicator
      if (snapIndicatorRef.current) {
        snapIndicatorRef.current.position.set(hit.x, 0.01, hit.z);
        snapIndicatorRef.current.visible = true;
      }

      updateGhostPreview(hit);
    },
    [raycastGround, updateGhostPreview, clearGhost],
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

      const material = ELEMENT_MATERIALS[el.type];
      const mesh = buildMeshForElement(el, material);
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

  // ── Click handler ──────────────────────────────────────────

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const world = worldRef.current;
      if (!world) return;

      const tool = creationToolRef.current;

      // ── Creation mode ──
      if (tool !== "none") {
        const hit = raycastGround(e);
        if (!hit) return;

        const point = { x: hit.x, z: hit.z };
        const params = defaultParamsRef.current;
        const needsTwoClicks = tool === "wall" || tool === "slab";

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
            level: 0,
          };
          onElementCreated(el);
        } else {
          // Single-click elements (column, door)
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

      highlightMesh(null);

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        highlightMesh(mesh);

        const globalId =
          (mesh.userData.bimElementId as string) || buildGlobalId(mesh);
        const element: SelectedElement = {
          expressID: (mesh.userData.expressID as number) || 0,
          globalId,
          type: (mesh.userData.type as string) || mesh.name || "Element",
          name: mesh.name || `Element #${mesh.id}`,
          properties: extractProperties(mesh),
        };
        onElementSelected(element);
      } else {
        onElementSelected(null);
      }
    },
    [
      onElementSelected,
      onElementCreated,
      highlightMesh,
      raycastGround,
      clearGhost,
    ],
  );

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
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          pendingStartRef.current = null;
          clearGhost();
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
          {creationTool === "wall" || creationTool === "slab" ? (
            pendingStartRef.current ? (
              <span>Click to set end point &middot; Esc to cancel</span>
            ) : (
              <span>Click to set start point</span>
            )
          ) : (
            <span>Click to place {creationTool}</span>
          )}
        </div>
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
