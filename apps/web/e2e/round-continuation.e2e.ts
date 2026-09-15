import { expect, test } from "@playwright/test"

test("requires one explicit Continue click per round when automatic progression is off", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
  const approvals: number[] = []
  page.on("request", request => {
    if (request.method() === "POST" && /\/api\/runs\/[^/]+\/continue$/.test(request.url())) {
      approvals.push(request.postDataJSON().roundIndex)
    }
  })
  await page.goto("/")
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /Upload My Scenario/ }).click()
  await (await chooser).setFiles({ name: "manual-rounds.md", mimeType: "text/markdown", buffer: Buffer.from("A product team debates a risky release.") })
  await page.getByLabel("Cast size").fill("3")
  await page.getByLabel("Max round").fill("3")
  await expect(page.getByRole("switch", { name: "Auto continue" })).not.toBeChecked()
  await page.getByRole("button", { name: "Start", exact: true }).click()
  const prompt = page.getByRole("dialog", { name: "Round complete" })
  for (const round of [1, 2]) {
    await expect(page.getByRole("heading", { name: `ROUND ${round}`, exact: true, includeHidden: true })).toHaveCount(1)
    await expect(prompt).toBeVisible()
    await expect(prompt.getByRole("switch", { name: "Auto continue" })).not.toBeChecked()
    await expect(prompt.getByRole("button", { name: "Continue", exact: true })).toBeEnabled()
    await expect(page.getByRole("heading", { name: `ROUND ${round + 1}`, exact: true, includeHidden: true })).toHaveCount(0)
    expect(approvals).toHaveLength(round - 1)
    await prompt.getByRole("button", { name: "Continue", exact: true }).click()
  }
  await expect(page.getByRole("dialog", { name: "Move to the Report page?" })).toBeVisible()
  expect(approvals).toEqual([1, 2])
})

test("shows a five-second countdown and cancels it when auto continue is disabled", async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
  const approvals: number[] = []
  page.on("request", request => {
    if (request.method() === "POST" && /\/api\/runs\/[^/]+\/continue$/.test(request.url())) approvals.push(request.postDataJSON().roundIndex)
  })
  await page.goto("/")
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /Upload My Scenario/ }).click()
  await (await chooser).setFiles({ name: "countdown.md", mimeType: "text/markdown", buffer: Buffer.from("A product team debates a risky release.") })
  await page.getByLabel("Cast size").fill("3")
  await page.getByLabel("Max round").fill("2")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  const prompt = page.getByRole("dialog", { name: "Round complete" })
  await expect(prompt).toBeVisible()
  await page.clock.pauseAt(new Date(Date.now() + 100))
  await prompt.getByRole("switch", { name: "Auto continue" }).check()
  await expect(prompt.getByRole("status")).toHaveText("Next round in 5s")
  await page.clock.runFor(4000)
  await expect(prompt.getByRole("status")).toHaveText("Next round in 1s")
  expect(approvals).toEqual([])
  await prompt.getByRole("switch", { name: "Auto continue" }).uncheck()
  await page.clock.runFor(6000)
  await expect(prompt).toBeVisible()
  await expect(prompt.getByRole("button", { name: "Continue", exact: true })).toBeEnabled()
  expect(approvals).toEqual([])
  await prompt.getByRole("switch", { name: "Auto continue" }).check()
  await expect(prompt.getByRole("status")).toHaveText("Next round in 5s")
  await page.clock.runFor(4999)
  expect(approvals).toEqual([])
  await page.clock.runFor(1)
  await expect.poll(() => approvals).toEqual([1])
  await expect(prompt).not.toBeVisible()
  await page.clock.resume()
  await expect(page.getByRole("dialog", { name: "Move to the Report page?" })).toBeVisible()
})

test("reload keeps the active simulation and automatic round progression", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
  let continuations = 0
  page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/continue")) continuations++ })
  await page.goto("/")
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /Upload My Scenario/ }).click()
  await (await chooser).setFiles({ name: "reload.md", mimeType: "text/markdown", buffer: Buffer.from("A team discusses a release.") })
  await page.getByLabel("Cast size").fill("3")
  await page.getByLabel("Max round").fill("3")
  await page.getByRole("switch", { name: "Auto continue" }).check()
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Round complete" })).toBeVisible()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.reload()
  await expect(page.getByRole("heading", { name: "Start a simulation", exact: true })).toHaveCount(0)
  await expect(page.getByRole("dialog", { name: "Round complete" })).toBeVisible()
  await expect(page.getByRole("switch", { name: "Auto continue" })).toBeChecked()
  await expect(page.getByRole("dialog", { name: "Move to the Report page?" })).toBeVisible({ timeout: 20000 })
  expect(continuations).toBe(2)
})

test("three automatic approvals remove later waits and disabling resets the streak", async ({ page }) => {
  test.setTimeout(45000)
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
  const approvals: number[] = []
  let fourth: import("@playwright/test").Route | undefined
  // The test model completes its scenario after three rounds. Feed later boundary events
  // explicitly to verify the frontend's longer continuation policy.
  const nextBoundary = (round: number) => page.evaluate(async (round) => {
    const path = "/src/ui/stores/run-store.ts"
    const { useRunStore } = await import(path)
    const store = useRunStore.getState()
    store.pushEvent(round === 5
      ? { type: "run.completed", runId: store.selectedRunId, timestamp: new Date().toISOString(), stopReason: "simulation_done" }
      : { type: "round.completed", runId: store.selectedRunId, timestamp: new Date().toISOString(), roundIndex: round + 1 })
  }, round)
  await page.route("**/api/runs/*/continue", async route => {
    const round = route.request().postDataJSON().roundIndex
    approvals.push(round)
    if (round === 4) fourth = route
    else {
      await route.fulfill({ json: { ok: true } })
      await nextBoundary(round)
    }
  })
  await page.goto("/")
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /Upload My Scenario/ }).click()
  await (await chooser).setFiles({ name: "automatic-streak.md", mimeType: "text/markdown", buffer: Buffer.from("A team discusses a release.") })
  await page.getByLabel("Cast size").fill("3")
  await page.getByLabel("Max round").fill("6")
  await page.getByRole("switch", { name: "Auto continue" }).check()
  await page.getByRole("button", { name: "Start", exact: true }).click()
  const prompt = page.getByRole("dialog", { name: "Round complete" })
  for (const round of [1, 2, 3]) {
    await expect(prompt).toBeVisible()
    await expect(prompt.getByRole("status")).toHaveText("Next round in 5s")
    expect(approvals).toHaveLength(round - 1)
    await expect.poll(() => approvals.includes(round), { timeout: 8000 }).toBe(true)
  }
  // Round four must send its approval before another five-second delay could elapse.
  await expect.poll(() => approvals, { timeout: 3000 }).toEqual([1, 2, 3, 4])
  await expect(prompt).toHaveCount(0)
  await fourth!.fulfill({ json: { ok: true } })
  const headerToggle = page.locator("header").getByRole("switch", { name: "Auto continue" })
  await expect(headerToggle).toBeEnabled()
  await headerToggle.uncheck()
  await nextBoundary(4)
  await expect(prompt).toBeVisible()
  await expect(prompt.getByRole("button", { name: "Continue", exact: true })).toBeEnabled()
  await prompt.getByRole("switch", { name: "Auto continue" }).check()
  await expect(prompt.getByRole("status")).toHaveText("Next round in 5s")
  await expect.poll(() => approvals.includes(5), { timeout: 8000 }).toBe(true)
  await expect(prompt).toHaveCount(0)
})
