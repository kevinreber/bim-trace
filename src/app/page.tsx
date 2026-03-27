"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { SpatialNode } from "@/components/Viewer3D";
import Sidebar from "@/components/Sidebar";

const Viewer3D = dynamic(() => import("@/components/Viewer3D"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-full flex items-center justify-center bg-[var(--background)]">
      <p className="text-slate-500 text-sm">Loading 3D engine...</p>
    </div>
  ),
});

export default function Home() {
  const [tree, setTree] = useState<SpatialNode[]>([]);

  const handleModelLoaded = useCallback((spatialTree: SpatialNode[]) => {
    setTree(spatialTree);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar tree={tree} />
      <Viewer3D onModelLoaded={handleModelLoaded} />
    </div>
  );
}
