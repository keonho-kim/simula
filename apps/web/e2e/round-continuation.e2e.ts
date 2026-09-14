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
