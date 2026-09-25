/**
 * Purpose: Verify a dropped run stream resumes by cursor and retains usable round controls.
 * Pattern: Browser transport recovery test.
 * Usage: bun run test:e2e apps/web/e2e/run-stream-reconnect.e2e.ts
 * Related: src/ui/hooks/use-run-event-stream.ts, src/backend/api/runs/event-stream.ts
 */
import { createServer } from "node:http"
import { request as httpsRequest } from "node:https"
import { expect, test } from "./fixtures"
import type { RunEvent } from "../../../src/shared/run"

test("EventSource reconnects after a closed response and resumes after its last accepted event", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "This drop-connection fixture uses Chromium redirect interception.")
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
  const { run } = await (await page.request.post("/api/runs", { data: { scenario: {
    text: "A team reviews a release.", language: "en",
    controls: { numCast: 2, actionsPerType: 1, maxRound: 2, fastMode: false, allowAdditionalCast: false },
  } } })).json()
  await page.request.post(`/api/runs/${run.id}/start`)
  let events: RunEvent[] = []
  await expect.poll(async () => {
    const detail = await (await page.request.get(`/api/runs/${run.id}`)).json()
    events = detail.events
    return events.some(event => event.type === "round.completed" && event.roundIndex === 1)
  }).toBe(true)
  const first = events[0]
  if (!first) throw new Error("Expected persisted run events")
  const body = JSON.stringify(first)
  const cursor = `${run.id}:${Buffer.byteLength(body) + 1}`
  const sessionCookie = (await page.context().cookies()).find(cookie => cookie.name === "simula-session")?.value
  if (!sessionCookie) throw new Error("Expected an owning browser session cookie")
  const reconnects: string[] = []
  const proxy = createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*")
    response.setHeader("Content-Type", "text/event-stream")
    const lastId = request.headers["last-event-id"]
    if (typeof lastId !== "string") {
      response.end(`retry: 50
id: ${cursor}
event: ${first.type}
data: ${body}

`)
      return
    }
    reconnects.push(lastId)
    const upstream = httpsRequest(`https://127.0.0.1:4011/api/runs/${run.id}/events`,
      { headers: { "Last-Event-ID": lastId, Cookie: `simula-session=${sessionCookie}` }, rejectUnauthorized: false }, incoming => {
        incoming.pipe(response)
      })
    response.on("close", () => upstream.destroy())
    upstream.on("error", error => { if (!response.destroyed) response.destroy(error) })
    upstream.end()
  })
  await new Promise<void>(resolve => proxy.listen(0, "127.0.0.1", resolve))
  const address = proxy.address()
  if (!address || typeof address === "string") throw new Error("Missing proxy port")
  await page.route(`**/api/runs/${run.id}/events*`, route => route.fulfill({ status: 307, headers: { location: `http://127.0.0.1:${address.port}/events` } }))
  try {
    await page.addInitScript(runId => {
      localStorage.setItem("simula.language", "en")
      sessionStorage.setItem("simula.run-session", JSON.stringify({ runId, viewMode: "simulation", autoContinue: false }))
    }, run.id)
    const errors: string[] = []
    const confirmedCursors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    page.on("response", response => {
      if (!response.url().endsWith(`/api/runs/${run.id}/ack`) || !response.ok()) return
      const cursor = (response.request().postDataJSON() as { cursor?: unknown }).cursor
      if (typeof cursor === "string") confirmedCursors.push(cursor)
    })
    await page.goto("/simulation")
    await page.waitForFunction(() => Boolean(window.__simulaE2E))
    await expect.poll(() => reconnects).toContain(cursor)
    await expect.poll(() => confirmedCursors.length).toBeGreaterThan(0)
    const prompt = page.getByRole("dialog", { name: "Round complete" })
    await expect(prompt).toBeVisible()
    await prompt.getByRole("button", { name: "Continue", exact: true }).click()
    await expect.poll(async () => (await (await page.request.get(`/api/runs/${run.id}`)).json()).run.status).toBe("completed")
    await expect(page.getByRole("dialog", { name: "Move to the Report page?" })).toBeVisible()
    await expect.poll(async () => (await (await page.request.get(`/api/runs/${run.id}`)).json()).events.length).toBe(0)
    const savedCount = await page.evaluate(async runId => {
      const moduleUrl = "/src/ui/shell/e2e-queries/runs.ts"
      const { readBrowserRun } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/shell/e2e-queries/runs")
      return (await readBrowserRun(runId))?.events.length ?? 0
    }, run.id)
    expect(savedCount).toBeGreaterThan(0)
    expect(errors).toEqual([])
  } finally {
    await page.close()
    proxy.closeAllConnections()
    await new Promise<void>(resolve => proxy.close(() => resolve()))
  }
})
