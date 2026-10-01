/**
 * Purpose: Verify preview-to-card latency, stable confirmation, and tactical layout without model calls.
 * Pattern: Browser streaming contract test with deterministic SSE snapshots.
 * Usage: bun run test:e2e live-arrival.e2e.ts --project=chromium
 * Related: apps/web/e2e/workspace-fixtures.ts, src/ui/hooks/use-actor-progress.ts
 */
import { expect, test } from "./fixtures"
import { seedWorkspace } from "./workspace-fixtures"
import type { ActorProgressSnapshot } from "@/shared/actor-progress"

const SAMPLE_COUNT = 12
const WIDTHS = [1920, 1440, 1024, 768, 390, 320]
test("completed messages appear individually and keep their slots when committed", async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.addInitScript(() => {
    let activeStreams = 0
    let activeWorkers = 0
    const OriginalWorker = window.Worker
    window.Worker = class extends OriginalWorker {
      private tracked = true
      constructor(...args: ConstructorParameters<typeof OriginalWorker>) {
        super(...args)
        performance.mark("active-workers", { detail: ++activeWorkers })
      }
      override terminate() {
        if (this.tracked) { this.tracked = false; performance.mark("active-workers", { detail: --activeWorkers }) }
        super.terminate()
      }
    }
    const Original = window.EventSource
    window.EventSource = class extends Original {
      private tracked = false
      override close() {
        if (this.tracked) { this.tracked = false; document.documentElement.dataset.actorStreams = String(--activeStreams) }
        super.close()
      }
      constructor(url: string | URL, options?: EventSourceInit) {
        super(url, options)
        if (!String(url).includes("actor-progress")) return
        this.tracked = true
        document.documentElement.dataset.actorStreams = String(++activeStreams)
        this.addEventListener("snapshot", (event: MessageEvent<string>) => {
          // This test observes its own fixed SSE payload; production parsing remains separate.
          const snapshot = JSON.parse(event.data) as { turns: Array<{ message?: { id: string } }> }
          for (const turn of snapshot.turns) {
            if (turn.message && !performance.getEntriesByName(`arrival:${turn.message.id}`).length) performance.mark(`arrival:${turn.message.id}`)
          }
        })
      }
    }
    new MutationObserver(() => {
      for (const card of document.querySelectorAll<HTMLElement>("[data-interaction-id]")) {
        const id = card.dataset.interactionId
        if (id && performance.getEntriesByName(`arrival:${id}`).length && !performance.getEntriesByName(`paint:${id}`).length) {
          performance.measure(`paint:${id}`, `arrival:${id}`)
        }
      }
    }).observe(document, { subtree: true, childList: true })
  })
  const detail = await seedWorkspace(page, "running")
  await page.route("**/api/runs", route => route.fulfill({ json: { runs: [detail.run] } }))
  await page.route(`**/api/runs/${detail.run.id}/events*`, route => route.fulfill({ contentType: "text/event-stream", body: ": connected\n\n" }))
  let snapshot: ActorProgressSnapshot = { runId: detail.run.id, streamId: "test-stream", revision: 1, roundIndex: 2, parallel: true, status: "running",
    turns: Array.from({ length: SAMPLE_COUNT }, (_, index) => ({ actorId: `actor-${index + 1}`, actorName: `참여자 ${index + 1}`, status: "working", timestamp: detail.run.createdAt })) }
  await page.route(`**/api/runs/${detail.run.id}/actor-progress`, route => route.fulfill({ contentType: "text/event-stream", body: `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n` }))
  await expect(page.getByRole("button", { name: /^열기:/ })).toBeVisible()
  const workerCount = () => page.evaluate(() => performance.getEntriesByName("active-workers").filter(entry => entry instanceof PerformanceMark).at(-1)?.detail ?? 0)
  const initialWorkers = await workerCount()
  await page.getByRole("button", { name: /^열기:/ }).click()
  await expect(page.locator('[data-appearance="tactical"]')).toBeVisible()
  await expect(page.getByText("라운드 2 준비 중 · 병렬 진행")).toBeVisible()
  const order = [1, 0, ...Array.from({ length: SAMPLE_COUNT - 2 }, (_, index) => index + 2)]
  for (const [position, index] of order.entries()) {
    const actorId = `actor-${index + 1}`
    snapshot = { ...snapshot, revision: snapshot.revision + 1, turns: snapshot.turns.map(turn => turn.actorId !== actorId ? turn : {
      ...turn, status: "ready", order: position, message: { id: `round-2-${actorId}`, actorId, actorName: turn.actorName, role: "검토자", targets: [],
        content: `ARRIVAL ${index + 1} · 다음 실험의 조건을 확인하겠습니다.`, action: "조건 확인", visibility: "public", decisionType: "action" },
    }) }
    await expect(page.locator(`[data-interaction-id="round-2-${actorId}"]`)).toContainText(`ARRIVAL ${index + 1}`, { timeout: 5000 })
    if (position === 0) await expect(page.locator('[data-interaction-id="round-2-actor-1"]')).toHaveCount(0)
  }
  const latencies = await page.evaluate(() => performance.getEntriesByType("measure").filter(entry => entry.name.startsWith("paint:round-2-")).map(entry => entry.duration).sort((a, b) => a - b))
  expect(latencies).toHaveLength(SAMPLE_COUNT)
  const p95 = latencies[Math.ceil(latencies.length * .95) - 1]
  expect(p95).toBeLessThanOrEqual(100)
  await testInfo.attach("arrival-latency", { body: JSON.stringify({ samples: latencies.length, p95, latencies }), contentType: "application/json" })
  console.log("ARRIVAL_LATENCY", JSON.stringify({ p95, samples: latencies.length }))
  await page.evaluate(async ({ snapshot, timestamp }) => {
    const { useRunStore } = await window.__simulaE2E!.import("/src/ui/stores/run-store.ts") as typeof import("@/ui/stores/run-store")
    useRunStore.getState().pushEvents(snapshot.turns.map(turn => ({ type: "interaction.recorded", runId: snapshot.runId, timestamp,
      interaction: { id: turn.message!.id, roundIndex: 2, sourceActorId: turn.actorId, targetActorIds: [], content: turn.message!.content, actionType: "조건 확인",
        eventId: "review", visibility: "public", decisionType: "action", intent: "", expectation: "" } })))
  }, { snapshot, timestamp: detail.run.createdAt })
  await expect(page.locator('[data-interaction-id="round-2-actor-12"]')).not.toHaveAttribute("data-delivery", "pending")
  const viewport = page.locator('[data-slot="actor-history-viewport"]')
  await viewport.evaluate(node => { node.scrollTop = 0 })
  await expect(page.locator('[data-interaction-id="round-2-actor-2"]')).toBeVisible()
  const top = await page.locator('[data-interaction-id="round-2-actor-2"]').boundingBox()
  const next = await page.locator('[data-interaction-id="round-2-actor-1"]').boundingBox()
  expect(top!.y).toBeLessThan(next!.y)
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`simulation-${width}.png`), fullPage: true })
  }
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  expect(await page.evaluate(() => document.documentElement.dataset.actorStreams)).toBe("0")
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden")
    document.dispatchEvent(new Event("visibilitychange"))
  })
  for (let visit = 0; visit < 3; visit++) {
    await page.getByRole("button", { name: "홈", exact: true }).click()
    await expect(page).toHaveURL("/")
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.actorStreams)).toBe("0")
    await expect.poll(workerCount).toBe(initialWorkers)
    if (visit < 2) {
      await page.getByRole("button", { name: /^열기:/ }).click()
      await expect(page.locator('[data-appearance="tactical"]')).toBeVisible()
    }
  }

})
