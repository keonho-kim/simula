/**
 * Purpose: Compare production startup and settings navigation against the prior checkout.
 * Pattern: Repeatable browser measurement.
 * Usage: bun apps/web/benchmarks/browser-workspace.ts with baseline on 4020 and candidate on 4021.
 * Related: docs/frontend-performance.md, apps/web/e2e/workspace-ui.e2e.ts
 */
import { chromium } from "@playwright/test"

const REPEATS = 5
const origins = { baseline: "http://localhost:4020", candidate: "http://localhost:4021" }
const browser = await chromium.launch()
const results: Record<string, Array<Record<string, number>>> = { baseline: [], candidate: [] }
try {
  for (let repeat = -1; repeat < REPEATS; repeat++) for (const [name, origin] of Object.entries(origins)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" })
    const page = await context.newPage()
    await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
    const cdp = await context.newCDPSession(page)
    await cdp.send("Performance.enable")
    await page.goto(origin)
    await page.getByRole("button", { name: /New Scenario/ }).waitFor()
    const start = await page.evaluate(() => ({ readyMs: performance.now(), fcpMs: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0,
      scriptBytes: performance.getEntriesByType("resource").reduce((total, entry) => {
        const resource = entry as PerformanceResourceTiming
        return total + (resource.initiatorType === "script" ? resource.encodedBodySize : 0)
      }, 0) }))
    const before = await cdp.send("Performance.getMetrics")
    const settingsOpenMs: number[] = []
    for (let iteration = 0; iteration < 5; iteration++) {
      const openedAt = performance.now()
      await page.getByRole("button", { name: "Settings", exact: true }).click()
      await page.getByRole("heading", { name: "LLM settings" }).waitFor()
      await page.getByRole("button", { name: "Save settings", exact: true }).waitFor()
      settingsOpenMs.push(performance.now() - openedAt)
      await page.getByRole("button", { name: "Back", exact: true }).click()
      await page.getByRole("button", { name: /New Scenario/ }).waitFor()
    }
    const after = await cdp.send("Performance.getMetrics")
    const measures = Object.fromEntries(["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"].map(key => [key,
      1000 * ((after.metrics.find(metric => metric.name === key)?.value ?? 0) - (before.metrics.find(metric => metric.name === key)?.value ?? 0))]))
    if (repeat >= 0) results[name].push({ ...start, ...measures, settingsOpenMs: settingsOpenMs.sort((a, b) => a - b)[2] })
    await context.close()
  }
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
  console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([name, runs]) => [name, {
    runs, median: Object.fromEntries(Object.keys(runs[0]).map(key => [key, Number(median(runs.map(run => run[key])).toFixed(2))])),
  }])), null, 2))
} finally { await browser.close() }
