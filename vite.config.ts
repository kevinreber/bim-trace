import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { apiProxyPlugin } from "./server/apiProxy";

export default defineConfig(({ mode }) => {
  // Load .env files so ANTHROPIC_API_KEY is available in process.env
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of Object.keys(env)) {
    if (!(key in process.env)) {
      process.env[key] = env[key];
    }
  }

  return {
    plugins: [
      TanStackRouterVite({
        routesDirectory: "./src/routes",
        generatedRouteTree: "./src/routeTree.gen.ts",
      }),
      react(),
      apiProxyPlugin(),
    ],
    resolve: {
      tsconfigPaths: true,
    },
  };
});
