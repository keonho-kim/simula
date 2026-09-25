/**
 * Purpose: Verify a closed owner tab cancels waiting work and removes server temp files.
 * Pattern: Browser lifecycle integration test.
 * Usage: bun run test:e2e apps/web/e2e/browser-expiry.e2e.ts --project=chromium
 * Related: src/backend/runtime/browser-sessions.ts, src/backend/runtime/expired-browser-work.ts
 */
import { access, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "./fixtures"

test("closing the owning tab removes an active run after the reconnect grace period", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/")
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
  const created = await page.request.post("/api/runs", { data: { scenario: { text: "Two colleagues discuss a release.", language: "en",
    controls: { numCast: 2, actionsPerType: 1, maxRound: 2, fastMode: false, allowAdditionalCast: false } } } })
  const { run } = await created.json() as { run: { id: string } }
  await page.request.post(`/api/runs/${run.id}/start`)
  await expect.poll(async () => {
    const detail = await (await page.request.get(`/api/runs/${run.id}`)).json()
    return detail.events.some((event: { type: string; roundIndex?: number }) => event.type === "round.completed" && event.roundIndex === 1)
  }, { timeout: 15_000 }).toBe(true)
  const roots = (await readdir(tmpdir(), { withFileTypes: true })).filter(entry => entry.isDirectory() && /^simula-active-\d+-/.test(entry.name))
  const paths = roots.map(root => join(tmpdir(), root.name, run.id))
  const present = await Promise.all(paths.map(path => access(path).then(() => true, () => false)))
  expect(present.some(Boolean)).toBe(true)
  await page.close()
  await expect.poll(async () => (await Promise.all(paths.map(path => access(path).then(() => true, () => false)))).some(Boolean),
    { timeout: 45_000, intervals: [1000] }).toBe(false)
})
