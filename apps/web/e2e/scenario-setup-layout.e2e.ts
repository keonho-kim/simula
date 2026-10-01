/**
 * Purpose: Verify the source-first editor uses its workspace columns without horizontal overflow.
 * Pattern: Browser layout contract test.
 * Usage: bun run test:e2e scenario-setup-layout.e2e.ts
 * Related: src/ui/pages/scenario-input-page.tsx, src/ui/styles/document-builder.css
 */
import { expect, test } from "./fixtures"

test("source setup uses a full page and stacks its columns on compact screens", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const editor = page.getByRole("main", { name: "New Scenario" })
  const source = editor.locator(".document-input-source"), options = editor.locator(".document-input-options")
  const left = await source.boundingBox(), right = await options.boundingBox()
  expect(left!.x + left!.width).toBeLessThan(right!.x)
  expect(left!.y).toBeCloseTo(right!.y, 0)
  await editor.getByLabel("Choose files").setInputFiles({ name: `${"long-name-".repeat(18)}.md`, mimeType: "text/markdown", buffer: Buffer.from("# Brief") })
  await editor.getByRole("button", { name: "Add participant" }).click()
  await editor.getByLabel("Name or role title").fill("A".repeat(80))
  for (const width of [1440, 758, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width < 1024) expect((await options.boundingBox())!.y).toBeGreaterThan((await source.boundingBox())!.y)
    await page.screenshot({ path: testInfo.outputPath(`scenario-${width}.png`), fullPage: true })
  }
})
