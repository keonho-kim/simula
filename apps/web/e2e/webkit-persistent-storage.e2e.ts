/**
 * Purpose: Verify OPFS-backed SQLite survives reload in a persistent WebKit profile.
 * Pattern: Browser storage integration test.
 * Usage: bun run test:e2e apps/web/e2e/webkit-persistent-storage.e2e.ts --project=webkit
 * Related: src/ui/browser-storage/database/worker.ts, playwright.config.ts
 */
import { expect, test, webkit } from "./fixtures"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("persistent WebKit stores SQLite records across a page reload", async ({ baseURL, browserName }) => {
  test.skip(browserName !== "webkit", "This checks WebKit's persistent OPFS profile.")
  const profile = await mkdtemp(join(tmpdir(), "simula-webkit-sqlite-"))
  try {
    // Playwright's default WebKit context is private and rejects getDirectory().
    const context = await webkit.launchPersistentContext(profile, { headless: true, ignoreHTTPSErrors: true })
    try {
      const page = context.pages()[0] ?? await context.newPage()
      await page.goto(baseURL ?? "https://127.0.0.1:4173")
      await page.waitForFunction(() => Boolean(window.__simulaE2E))
      const id = await page.evaluate(async () => {
        const moduleUrl = "/src/ui/browser-storage/database/connection.ts"
        const { browserDatabase } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/browser-storage/database/connection")
        const db = await browserDatabase(), key = crypto.randomUUID()
        await db.execute([{ sql: "INSERT INTO app_meta(key, value) VALUES (?, ?)", bind: [key, "saved"] }])
        return key
      })
      await page.reload()
      await page.waitForFunction(() => Boolean(window.__simulaE2E))
      const restored = await page.evaluate(async key => {
        const moduleUrl = "/src/ui/browser-storage/database/connection.ts"
        const { browserDatabase } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/browser-storage/database/connection")
        const rows = await (await browserDatabase()).query<{ value: string }>({ sql: "SELECT value FROM app_meta WHERE key = ?", bind: [key] })
        return rows[0]?.value
      }, id)
      expect(restored).toBe("saved")
    } finally { await context.close() }
  } finally { await rm(profile, { recursive: true, force: true }) }
})
