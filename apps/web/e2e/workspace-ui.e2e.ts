/**
 * Purpose: Verify full workspace pages and editorial reports across the supported widths.
 * Pattern: Browser workflow and visual regression test.
 * Usage: bun run test:e2e workspace-ui.e2e.ts --project=chromium
 * Related: apps/web/e2e/workspace-fixtures.ts, src/ui/styles/workspace.css
 */
import { expect, test } from "./fixtures"
import { seedWorkspace } from "./workspace-fixtures"

const WIDTHS = [1920, 1440, 1024, 768, 390, 320]
test("workspace and report use the 80 percent frame without overflow", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const detail = await seedWorkspace(page)
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1000 })
    const frame = page.locator(".workspace-frame")
    const box = await frame.boundingBox()
    expect(box!.x / width).toBeCloseTo(0.1, 2)
    expect(box!.width / width).toBeCloseTo(0.8, 2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), fullPage: true })
  }
  await page.goto(`/reports/${detail.run.id}`)
  await expect(page.getByRole("article", { name: "종합 결론" })).toBeVisible()
  await expect(page.getByRole("region", { name: "모델 지표" })).toHaveCount(0)
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`report-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole("button", { name: /핵심 결과/ }).filter({ visible: true }).click()
  await expect(page.getByRole("article", { name: "핵심 결과" })).toBeVisible()
  await expect(page.getByRole("article", { name: "종합 결론" })).toHaveCount(0)
  const evidence = page.getByRole("button", { name: "근거 1", exact: true })
  await evidence.click()
  await expect(page.getByRole("button", { name: "근거 닫기" })).toBeFocused()
  await page.getByRole("button", { name: "근거 닫기" }).click()
  await expect(evidence).toBeFocused()
})

test("source editing survives settings and browser back confirmation", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/")
  await page.getByRole("button", { name: /New Scenario/ }).click()
  await expect(page).toHaveURL(/\/scenario\/new$/)
  await page.getByLabel("Situation to simulate · optional").fill("Check a release decision.")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole("heading", { name: "LLM settings" })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("heading", { name: "LLM settings" })).toBeVisible()
  await page.getByRole("button", { name: "Back", exact: true }).click()
  await expect(page.getByLabel("Situation to simulate · optional")).toHaveValue("Check a release decision.")
  await page.goBack()
  const confirm = page.getByRole("dialog", { name: "Save changes before closing?" })
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: "Continue editing" }).click()
  await expect(page).toHaveURL(/\/scenario\/new$/)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`source-${width}.png`), fullPage: true })
  }
})

test("settings preserve the workspace width and support enlarged text", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/settings")
  await expect(page.getByRole("button", { name: "Save settings", exact: true })).toBeEnabled()
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1000 })
    const box = await page.locator(".workspace-frame").boundingBox()
    expect(box!.x / width).toBeCloseTo(.1, 2)
    expect(box!.width / width).toBeCloseTo(.8, 2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => { document.documentElement.style.zoom = "2" })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole("button", { name: "Back", exact: true }).focus()
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL("/")
})
