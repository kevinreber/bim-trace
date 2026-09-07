import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Deliberately standalone rather than extending vite.config.ts: that config
// registers the API proxy plugin, which pulls in the Anthropic SDK and reads
// .env files. Unit tests need neither.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
    environment: "node",
  },
});
