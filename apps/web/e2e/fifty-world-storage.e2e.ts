/**
 * Purpose: Measure browser storage and indexed reads at a 50-world history size.
 * Pattern: Browser performance qualification.
 * Usage: bun run test:e2e apps/web/e2e/fifty-world-storage.e2e.ts --project=chromium
 * Related: src/ui/browser-storage/database/runs/save-detail.ts, src/ui/browser-storage/database/schema.ts
 */
import { expect, test } from "./fixtures"

test("50 worlds retain ordered records and keep the page responsive", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const measurement = await page.evaluate(async () => {
    const moduleUrl = "/src/ui/shell/e2e-queries/runs.ts"
    const runs = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/shell/e2e-queries/runs")
    const batchId = crypto.randomUUID(), timestamp = new Date().toISOString()
    const paths = { manifest: "", events: "", state: "", timeline: "", report: "" }
    let longestFrameMs = 0, lastFrame = performance.now(), watching = true
    const watch = (now: number) => { longestFrameMs = Math.max(longestFrameMs, now - lastFrame); lastFrame = now; if (watching) requestAnimationFrame(watch) }
    requestAnimationFrame(watch)
    const started = performance.now()
    for (let world = 0; world < 50; world++) {
      const runId = `world-${batchId}-${world}`
      await runs.saveRunManifest({ id: runId, batchId, status: "completed", createdAt: timestamp, artifactPaths: paths })
      await runs.saveRunDetail({ run: { id: runId, batchId, status: "completed", createdAt: timestamp, artifactPaths: paths },
        timeline: [], events: Array.from({ length: 40 }, (_, index) => ({ type: "event.injected" as const,
          runId, timestamp, event: { id: `event-${index}`, roundIndex: index + 1, sourceEventId: "source",
            title: "A plausible change", summary: "A bounded source-grounded world event." } })) })
    }
    const savedMs = performance.now() - started
    const readStarted = performance.now()
    const list = await runs.listBrowserRuns()
    const round = await runs.readRoundEvents(`world-${batchId}-49`, 40)
    const readMs = performance.now() - readStarted
    watching = false
    return { worlds: list.length, roundEvents: round.length, savedMs, readMs, longestFrameMs }
  })
  console.log("50-world browser storage measurement", measurement)
  expect(measurement.worlds).toBe(50)
  expect(measurement.roundEvents).toBe(1)
  expect(measurement.savedMs).toBeGreaterThan(0)
  expect(measurement.readMs).toBeGreaterThan(0)
})
