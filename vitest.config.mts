import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Unit tests only for now, so plain Node is enough: no jsdom or React Testing Library.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
