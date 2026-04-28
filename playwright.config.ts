import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./apps/web/e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command:
        "PORT=4011 SIMULA_DATA_DIR=.e2e-runs SIMULA_SETTINGS_PATH=.e2e-settings.json bun --filter @simula/server start",
      port: 4011,
      reuseExistingServer: false,
    },
    {
      command:
        "SIMULA_API_ORIGIN=http://127.0.0.1:4011 bun --filter @simula/web dev --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
