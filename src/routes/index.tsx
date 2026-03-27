import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Viewer3D, { type SpatialNode } from "@/components/Viewer3D";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
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
