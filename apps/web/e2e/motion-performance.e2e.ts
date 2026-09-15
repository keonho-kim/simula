import { expect, test, type Route } from "@playwright/test"

test("board navigation stays usable under CPU and network throttling", async ({ page }, testInfo) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
  let start: Route | undefined
  await page.route("**/api/runs/*/start", route => { start = route })
  await page.goto("/")
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /Upload My Scenario/ }).click()
  await (await chooser).setFiles({ name: "motion.md", mimeType: "text/markdown", buffer: Buffer.from("A team plans a release.") })
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await expect.poll(() => Boolean(start)).toBe(true)
  await page.evaluate(async () => {
    const path = "/src/ui/stores/run-store.ts"
    const { useRunStore } = await import(path)
    const store = useRunStore.getState()
    const base = { runId: store.selectedRunId, timestamp: new Date().toISOString() }
    store.pushEvents([{ ...base, type: "run.started" },
      { ...base, type: "board.updated", update: { kind: "config", actorCount: 20, actionCount: 100 } },
      { ...base, type: "board.updated", update: { kind: "events", events: Array.from({ length: 100 }, (_, i) => ({ id: "e" + i, title: "Event " + i, summary: "Long scenario detail. ".repeat(200), status: "pending", participantIds: [] })) } },
    ])
  })
  const board = page.getByRole("dialog", { name: "Scenario Board", exact: true })
  await expect(board).toBeVisible()
  const originalColumn = await board.locator('section[aria-label="Expected events"]').elementHandle()
  await board.getByRole("button", { name: /Event 0$/, exact: false }).click()
  expect(await originalColumn!.evaluate(element => element.isConnected)).toBe(true)
  await board.getByRole("button", { name: /All columns/ }).click()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 })
  await cdp.send("Network.enable")
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 100, downloadThroughput: 2000000, uploadThroughput: 1000000 })
  await cdp.send("Performance.enable")
  const before = await cdp.send("Performance.getMetrics")
  for (let i = 0; i < 6; i++) {
    await board.getByRole("button", { name: /Event 0$/ }).click()
    await expect(board.getByRole("complementary")).toContainText("Long scenario detail.")
    await board.getByRole("button", { name: /All columns/ }).click()
    await expect(board.locator('section[aria-label]')).toHaveCount(4)
  }
  const after = await cdp.send("Performance.getMetrics")
  const names = ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "LayoutCount", "RecalcStyleCount"]
  const metrics = Object.fromEntries(names.map(name => [name, after.metrics.find(m => m.name === name)!.value - before.metrics.find(m => m.name === name)!.value]))
  console.log("MOTION_METRICS", JSON.stringify(metrics))
  await testInfo.attach("motion-metrics", { body: JSON.stringify(metrics), contentType: "application/json" })
  await page.evaluate(async () => {
    const path = "/src/ui/stores/run-store.ts"
    const { useRunStore } = await import(path)
    const store = useRunStore.getState()
    const base = { runId: store.selectedRunId, timestamp: new Date().toISOString(), type: "board.updated" }
    store.pushEvents([
      { ...base, update: { kind: "roster", actors: Array.from({ length: 20 }, (_, index) => ({ index: index + 1, name: "Actor " + index, roleSeed: "Role" })) } },
      ...Array.from({ length: 20 }, (_, index) => ({ ...base, update: { kind: "actor.started", id: "actor-" + (index + 1) } })),
    ])
  })
  await expect(board.locator(".scenario-board-active")).toHaveCount(20)
  await expect(board.locator(".scenario-board-pulsing")).toHaveCount(1)
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  expect(await board.locator(".scenario-progress-dot").first().evaluate(element => getComputedStyle(element).animationPlayState)).toBe("paused")
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden")
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await board.getByRole("button", { name: /Event 0$/ }).click()
  await expect(board.getByRole("complementary")).toBeVisible()
  expect(await board.locator('section[aria-label="Expected events"]').evaluate(element => getComputedStyle(element).transform)).toBe("none")
  expect(await board.locator(".scenario-progress-dot").first().evaluate(element => getComputedStyle(element).animationName)).toBe("none")
  await page.screenshot({ path: testInfo.outputPath("motion-detail.png") })
  await start!.abort()
})
