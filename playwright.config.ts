/**
 * Purpose: Run browser workflows against one production-like Next host.
 * Pattern: Test configuration.
 * Usage: bun run test:e2e.
 * Related: server.ts, apps/web/e2e/smoke.e2e.ts
 */
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./apps/web/e2e",
  testMatch: "**/*.e2e.ts",
  testIgnore: "**/live-poc.e2e.ts",
  timeout: 30_000,
  use: {
    baseURL: "https://127.0.0.1:4011",
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: "SIMULA_HTTPS=1 SIMULA_TEST_MODEL=1 NODE_ENV=production PORT=4011 node --import tsx server.ts",
    url: "https://127.0.0.1:4011/api/settings/defaults",
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "edge", use: { ...devices["Desktop Chrome"], channel: "msedge" } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
})
