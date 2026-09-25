/**
 * Purpose: Verify temporary server runs and settings remain private to their browser owner.
 * Pattern: Browser boundary test.
 * Usage: bun run test:e2e apps/web/e2e/browser-session.e2e.ts --project=chromium
 * Related: src/backend/api/browser-session-gate.ts, src/backend/storage/settings-store.ts
 */
import { expect, test } from "./fixtures"

test("separate browser profiles cannot read each other's active runs or settings", async ({ browser, baseURL }) => {
  const first = await browser.newContext({ baseURL, ignoreHTTPSErrors: true })
  const second = await browser.newContext({ baseURL, ignoreHTTPSErrors: true })
  try {
    await (await first.newPage()).goto("/")
    await (await second.newPage()).goto("/")
    const defaults = (await (await first.request.get("/api/settings/defaults")).json()).settings
    const sampleList = (await (await first.request.get("/api/scenarios/samples")).json()).samples
    const sample = (await (await first.request.get(`/api/scenarios/samples/${sampleList[0].name}`)).json()).sample
    const created = await first.request.post("/api/runs", { data: { scenario: { sourceName: sample.name, text: sample.text,
      controls: sample.controls, language: "en" } } })
    expect(created.status()).toBe(201)
    const id = (await created.json()).run.id as string
    expect((await second.request.get(`/api/runs/${id}`)).status()).toBe(404)
    const secondList = (await (await second.request.get("/api/runs")).json()).runs
    expect(secondList).not.toContainEqual(expect.objectContaining({ id }))
    const custom = { ...defaults, concurrency: 2 }
    expect((await first.request.put("/api/settings", { data: { settings: custom } })).ok()).toBe(true)
    expect((await (await first.request.get("/api/settings")).json()).settings.concurrency).toBe(2)
    expect((await (await second.request.get("/api/settings")).json()).settings.concurrency).toBe(defaults.concurrency)
  } finally { await first.close(); await second.close() }
})
