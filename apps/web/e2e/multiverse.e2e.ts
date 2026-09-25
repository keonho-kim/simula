/**
 * Purpose: Verify selectable worlds, scoped manual approval, background progression, and responsive reopening.
 * Pattern: Browser workflow test with deterministic server generation.
 * Usage: bun run test:e2e apps/web/e2e/multiverse.e2e.ts
 * Related: src/ui/components/multiverse/multiverse-panel.tsx, src/backend/runtime/multiverse/jobs.ts
 */
import { expect, test } from "./fixtures"

test("two worlds retain independent approvals and finish in the background after reopening", async ({ page }, testInfo) => {
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  settings.roles.storyBuilder.provider = "openai"
  await page.request.put("/api/settings", { data: { settings } })
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/")
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const dialog = page.getByRole("dialog", { name: "New Scenario" })
  await dialog.getByLabel("Choose files").setInputFiles({ name: "investment.txt", mimeType: "text/plain", buffer: Buffer.from("The CTO and Finance must decide whether to invest 120 million won in the proposed project.") })
  await dialog.getByRole("button", { name: "Run", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Confirm scenario", exact: true })).toBeVisible({ timeout: 15_000 })
  await dialog.getByRole("button", { name: "Confirm scenario", exact: true }).click()
  await dialog.getByRole("switch", { name: "Multiverse", exact: true }).check()
  const panel = dialog.getByTestId("multiverse-panel")
  await panel.getByLabel("Number of worlds", { exact: true }).fill("2")
  await panel.getByLabel("Max round", { exact: true }).fill("2")
  await panel.getByLabel("Actions per type", { exact: true }).fill("1")
  await panel.getByRole("switch", { name: "Auto continue", exact: true }).uncheck()
  const created = page.waitForResponse(response => response.url().endsWith("/api/multiverse") && response.request().method() === "POST")
  await panel.getByRole("button", { name: "Start worlds", exact: true }).click()
  const { batch } = await (await created).json()
  const readBatch = async () => (await (await page.request.get(`/api/multiverse/${batch.id}`)).json()).batch
  await expect.poll(async () => (await readBatch()).worlds.map((world: { status: string }) => world.status)).toEqual(["waiting", "waiting"])
  await expect(panel.getByRole("button", { name: "Continue this world", exact: true })).toBeVisible()
  await panel.getByRole("button", { name: "Continue this world", exact: true }).click()
  await expect.poll(async () => (await readBatch()).worlds.map((world: { status: string }) => world.status)).toEqual(["completed", "waiting"])
  await panel.getByRole("combobox", { name: "Select a world" }).click()
  await page.getByRole("option", { name: /World 2/ }).click()
  await panel.getByRole("switch", { name: "Auto continue", exact: true }).check()
  await expect(panel.getByText("The server will continue this world after its countdown.")).toBeVisible()
  await dialog.getByRole("button", { name: "Close", exact: true }).click()
  await page.reload()
  await expect.poll(async () => (await readBatch()).status, { timeout: 15_000 }).toBe("completed")
  await page.getByRole("button", { name: /New Scenario/ }).click()
  await expect(panel.getByRole("status")).toContainText("2 of 2 worlds completed")
  await page.screenshot({ path: testInfo.outputPath("multiverse-desktop.png"), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => {
    const box = await dialog.boundingBox()
    return !!box && box.x >= 0 && box.x + box.width <= 390
  }).toBe(true)
  await expect.poll(() => dialog.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("multiverse-mobile.png"), fullPage: true })
  await panel.getByRole("button", { name: "Open this world's result", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Analysis board", exact: true })).toBeVisible()
})
