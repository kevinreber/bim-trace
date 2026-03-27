import * as OBC from "@thatopen/components";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

export interface SpatialNode {
  expressID: number;
  type: string;
  name: string;
  children: SpatialNode[];
}

interface Viewer3DProps {
  onModelLoaded: (tree: SpatialNode[]) => void;
}

export default function Viewer3D({ onModelLoaded }: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<OBC.Components | null>(null);
  const worldRef = useRef<OBC.SimpleWorld<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
  > | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasModel, setHasModel] = useState(false);

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

    return () => {
      components.dispose();
    };
  }, []);

  const loadIfc = useCallback(
    async (file: File) => {
      const components = componentsRef.current;
      const world = worldRef.current;
      if (!components || !world) return;

      setLoading(true);

      try {
        // Initialize FragmentsManager with worker
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

        // Frame the camera on the loaded model
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

        // Extract spatial tree
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
    [onModelLoaded],
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

  return (
    <div
      ref={containerRef}
      role="application"
      className="relative flex-1 h-full"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
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

      {!hasModel && !loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-center pointer-events-auto">
            <p className="text-slate-400 text-lg mb-4">
              Drag & drop an .ifc file here
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
}

// biome-ignore lint/suspicious/noExplicitAny: FragmentsModel API is loosely typed
async function buildSpatialTree(model: any): Promise<SpatialNode[]> {
  try {
    // Try v3 API: getSpatialStructure
    if (typeof model.getSpatialStructure === "function") {
      const structure = await model.getSpatialStructure();
      if (structure) {
        return parseSpatialStructure(structure);
      }
    }
  } catch (e) {
    console.warn("getSpatialStructure failed:", e);
  }

  // Fallback: extract from categories
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
