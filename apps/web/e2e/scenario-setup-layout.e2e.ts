/**
 * Purpose: Verify the input-only scenario modal retains its bounded responsive layout.
 * Pattern: Browser layout contract test.
 * Usage: bun run test:e2e apps/web/e2e/scenario-setup-layout.e2e.ts
 * Related: src/ui/components/scenario-builder/scenario-builder-dialog.tsx
 */
import { expect, test } from "./fixtures"

test("setup uses one modal scroll surface without nested or horizontal overflow", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const dialog = page.getByRole("dialog", { name: "New Scenario" })
  const form = dialog.locator(".document-builder-form")
  const files = form.locator(":scope > fieldset")
  const options = form.locator(":scope > [data-slot='field-group']")
  const fileBox = await files.boundingBox()
  const optionBox = await options.boundingBox()
  const pageBox = await dialog.boundingBox()
  expect(fileBox && optionBox && optionBox.y >= fileBox.y + fileBox.height).toBe(true)
  expect(pageBox && pageBox.width > 900).toBe(true)
  const typeField = dialog.getByLabel("Situation type · optional").locator("xpath=ancestor::*[@data-slot='field'][1]")
  const fastField = dialog.getByRole("switch", { name: "Fast processing" }).locator("xpath=ancestor::*[@data-slot='field'][1]")
  expect((await typeField.boundingBox())!.y).toBeCloseTo((await fastField.boundingBox())!.y, 0)
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await expect(dialog.getByRole("button", { name: "Import finished scenario" })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("scenario-setup-desktop.png"), fullPage: true })
  await page.setViewportSize({ width: 758, height: 713 })
  const body = dialog.locator(".document-scenario-body")
  const mediumOverflow = await body.evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }))
  expect(mediumOverflow.scroll).toBeLessThanOrEqual(mediumOverflow.client + 1)
  expect(await body.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
  expect(await dialog.evaluate(node => getComputedStyle(node).overflowY)).toBe("auto")
  await expect.poll(() => dialog.evaluate(node => parseFloat(getComputedStyle(node).maxHeight))).toBeLessThan(713)
  expect((await dialog.boundingBox())!.height).toBeLessThan(713)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("scenario-setup-medium.png"), fullPage: true })
  await dialog.getByLabel("Choose files").setInputFiles({
    name: `${"long-name-".repeat(18)}.md`, mimeType: "text/markdown", buffer: Buffer.from("# Long name"),
  })
  await dialog.getByRole("button", { name: "Add participant" }).click()
  await dialog.getByLabel("Name or role title").fill("A".repeat(80))
  expect(await body.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  expect(await dialog.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  expect((await fastField.boundingBox())!.y).toBeGreaterThan((await typeField.boundingBox())!.y)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  const mobileOverflow = await body.evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }))
  expect(mobileOverflow.scroll).toBeLessThanOrEqual(mobileOverflow.client + 1)
})
