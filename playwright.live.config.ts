/**
 * Purpose: Run an isolated browser journey against actual local Ornith inference.
 * Pattern: Test configuration.
 * Usage: bunx playwright test -c playwright.live.config.ts
 * Related: scripts/start-live-poc-server.ts, apps/web/e2e/live-poc.e2e.ts
 */
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./apps/web/e2e",
  testMatch: "live-poc.e2e.ts",
  timeout: 900_000,
  use: { baseURL: "https://127.0.0.1:4019", ignoreHTTPSErrors: true, trace: "on", screenshot: "only-on-failure" },
  webServer: { command: "bun scripts/ensure-dev-tls.ts && node --import tsx scripts/start-live-poc-server.ts", url: "https://127.0.0.1:4019",
    timeout: 60_000, reuseExistingServer: false },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
