import { defineConfig } from "vitest/config";

// Relative base so the build works when uploaded to CrazyGames (served from a sub-path).
export default defineConfig({
  base: "./",
  build: { target: "es2020", assetsInlineLimit: 8192 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
