/**
 * Purpose: Verify workspace hierarchy and form reachability in both supported locales.
 * Pattern: Browser presentation contract test.
 * Usage: bunx playwright test apps/web/e2e/workspace-design.e2e.ts.
 * Related: src/ui/pages/start-screen.tsx, src/ui/styles/workspace.css
 */
import { expect, test } from "./fixtures"
import { dictionary } from "@/ui/i18n/dictionary"

for (const locale of ["en", "ko"] as const) test(`workspace navigation and task panels stay usable in ${locale}`, async ({ page }, testInfo) => {
  const t = dictionary[locale]
  await page.addInitScript(language => localStorage.setItem("simula.language", language), locale)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(page.getByRole("heading", { name: t.workspaceTitle })).toBeVisible()
  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    const frame = (await page.locator(".workspace-frame").boundingBox())!
    expect(Math.abs(frame.width - width * .8)).toBeLessThan(1)
    expect(Math.abs(frame.x - width * .1)).toBeLessThan(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const navigation = page.getByRole("navigation", { name: t.workspaceStart })
    await expect(navigation.getByRole("button", { name: t.settings, exact: true })).toBeVisible()
    const nav = (await navigation.boundingBox())!
    const content = (await page.locator(".dashboard-content").boundingBox())!
    if (width >= 1024) expect(nav.x + nav.width).toBeLessThan(content.x)
    else expect(nav.y + nav.height).toBeLessThan(content.y)
    if (width === 1440 || width === 390) await page.screenshot({ path: testInfo.outputPath(`home-${locale}-${width}.png`), fullPage: true })
  }
  await page.getByRole("button", { name: t.newScenario, exact: true }).click()
  await expect(page.getByRole("main", { name: t.newScenario })).toBeVisible()
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width !== 320) await page.screenshot({ path: testInfo.outputPath(`input-${locale}-${width}.png`), fullPage: true })
  }
  await page.getByRole("button", { name: t.settings, exact: true }).click()
  await expect(page.getByRole("main", { name: t.settingsTitle })).toBeVisible()
  const credential = page.getByLabel(t.vaultPassphrase, { exact: true })
  await expect(credential).toBeVisible()
  await page.setViewportSize({ width: 1920, height: 1000 })
  expect((await credential.boundingBox())!.width).toBeLessThanOrEqual(480)
  await page.screenshot({ path: testInfo.outputPath(`settings-${locale}.png`), fullPage: true })
  await page.getByRole("button", { name: t.workspaceBack, exact: true }).click()
  await expect(page.getByRole("main", { name: t.newScenario })).toBeVisible()
})
