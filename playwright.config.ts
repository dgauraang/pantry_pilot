import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3000"
  },
  webServer: {
    command: "npm run db:prepare:dev && npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    env: {
      CHOKIDAR_USEPOLLING: "true"
    }
  }
});
