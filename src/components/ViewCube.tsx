import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

// ── Types ──────────────────────────────────────────────────────

export type ViewDirection = [number, number, number];

interface ViewCubeProps {
  /**
   * Returns the current main camera's position, target, and up vector.
   * Called every frame so the cube mirrors the main camera's orientation.
   */
  getCameraState: () => {
    position: THREE.Vector3;
    target: THREE.Vector3;
    up: THREE.Vector3;
  } | null;
  /** Invoked when the user clicks a face, edge, or corner of the cube. */
  onSelectView: (dir: ViewDirection) => void;
  /** Invoked when the Home button is clicked. */
  onHome: () => void;
}

// ── Face label texture ─────────────────────────────────────────

function makeFaceTexture(label: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, size - 6, size - 6);

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 56px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

// ── Hit-point → view direction ─────────────────────────────────

/**
 * Given a raycast hit point on a unit cube (half-extent 0.5), returns the
 * view direction for the face / edge / corner region that was clicked.
 *
 * Threshold 0.25 means each face is divided into 3×3 zones:
 *   - centre → axial view (face)
 *   - edge   → 2-axis diagonal view
 *   - corner → 3-axis isometric view
 */
function hitToDirection(point: THREE.Vector3): ViewDirection {
  const threshold = 0.25;
  const quant = (v: number) => {
    if (Math.abs(v) < threshold) return 0;
    return v > 0 ? 1 : -1;
  };
  let x = quant(point.x);
  let y = quant(point.y);
  let z = quant(point.z);

  // Safety: if somehow all zero (shouldn't happen on cube surface), snap to
  // the dominant axis.
  if (x === 0 && y === 0 && z === 0) {
    const ax = Math.abs(point.x);
    const ay = Math.abs(point.y);
    const az = Math.abs(point.z);
    if (ax >= ay && ax >= az) x = point.x > 0 ? 1 : -1;
    else if (ay >= az) y = point.y > 0 ? 1 : -1;
    else z = point.z > 0 ? 1 : -1;
  }
  return [x, y, z];
}

// ── Component ──────────────────────────────────────────────────

const CUBE_SIZE = 120;

export default function ViewCube({
  getCameraState,
  onSelectView,
  onHome,
}: ViewCubeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);
  const hoverOverlayRef = useRef<THREE.Mesh | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafRef = useRef<number | null>(null);
  const hoverDirRef = useRef<ViewDirection | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(CUBE_SIZE, CUBE_SIZE, false);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(2.2, 1.6, 2.2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Soft lighting so all faces are readable.
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.4);
    dir.position.set(1, 2, 1.5);
    scene.add(dir);

    // Cube with labeled face textures. Box face order: +X,-X,+Y,-Y,+Z,-Z.
    const labels = ["RIGHT", "LEFT", "TOP", "BOTTOM", "FRONT", "BACK"];
    const materials = labels.map(
      (label) =>
        new THREE.MeshLambertMaterial({
          map: makeFaceTexture(label),
        }),
    );
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);
    scene.add(cube);
    cubeRef.current = cube;

    // Dark edges overlay.
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(cube.geometry),
      new THREE.LineBasicMaterial({ color: 0x334155 }),
    );
    cube.add(edges);

    // Hover highlight — a tiny box snapped to the hovered region.
    const hoverOverlay = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.35,
        depthTest: false,
      }),
    );
    hoverOverlay.visible = false;
    hoverOverlay.renderOrder = 10;
    scene.add(hoverOverlay);
    hoverOverlayRef.current = hoverOverlay;

    let disposed = false;

    const tick = () => {
      if (disposed) return;
      const state = getCameraState();
      if (state && cameraRef.current) {
        const offset = state.position.clone().sub(state.target);
        const len = offset.length();
        if (len > 1e-6) {
          offset.normalize().multiplyScalar(3);
          cameraRef.current.position.copy(offset);
          cameraRef.current.up.copy(state.up);
          cameraRef.current.lookAt(0, 0, 0);
        }
      }
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      for (const m of materials) {
        m.map?.dispose();
        m.dispose();
      }
      cube.geometry.dispose();
      edges.geometry.dispose();
      (edges.material as THREE.Material).dispose();
      hoverOverlay.geometry.dispose();
      (hoverOverlay.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, [getCameraState]);

  // ── Pointer interaction ────────────────────────────────────

  const pickDirection = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): ViewDirection | null => {
      const canvas = canvasRef.current;
      const cube = cubeRef.current;
      const camera = cameraRef.current;
      if (!canvas || !cube || !camera) return null;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const hit = raycaster.intersectObject(cube, false)[0];
      if (!hit) return null;
      return hitToDirection(hit.point);
    },
    [],
  );

  const updateHoverOverlay = useCallback((dir: ViewDirection | null) => {
    const overlay = hoverOverlayRef.current;
    if (!overlay) return;
    if (!dir) {
      overlay.visible = false;
      hoverDirRef.current = null;
      return;
    }
    // Size the overlay: 1 on axes the region spans, ~0.4 on axes it pins to.
    const span = (v: number) => (v === 0 ? 1 : 0.4);
    overlay.scale.set(span(dir[0]), span(dir[1]), span(dir[2]));
    overlay.position.set(dir[0] * 0.3, dir[1] * 0.3, dir[2] * 0.3);
    overlay.visible = true;
    hoverDirRef.current = dir;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      updateHoverOverlay(pickDirection(e));
    },
    [pickDirection, updateHoverOverlay],
  );

  const handleMouseLeave = useCallback(() => {
    updateHoverOverlay(null);
  }, [updateHoverOverlay]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const dir = pickDirection(e);
      if (dir) onSelectView(dir);
    },
    [pickDirection, onSelectView],
  );

  return (
    <div
      className="absolute top-3 right-3 z-20 flex flex-col items-center gap-1 pointer-events-none select-none"
      style={{ width: CUBE_SIZE }}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-auto cursor-pointer drop-shadow-lg"
        style={{ width: CUBE_SIZE, height: CUBE_SIZE }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      <button
        type="button"
        className="pointer-events-auto px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 backdrop-blur-sm"
        onClick={onHome}
        title="Home view (reset to default 3D)"
      >
        Home
      </button>
    </div>
  );
}
