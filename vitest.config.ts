import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  },
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname
    }
  }
});
