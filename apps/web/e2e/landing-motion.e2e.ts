/**
 * Purpose: Verify landing menu motion, focus behavior, and reduced-motion fallback.
 * Pattern: End-to-end visual behavior test.
 * Usage: Executed by Playwright through bun run test:e2e.
 * Related: src/ui/pages/start-screen.tsx, src/ui/styles/start-screen.css
 */
import { expect, test } from "@playwright/test"

test("landing menu uses lightweight transform motion", async ({ page }) => {
  await page.goto("/")
  const tile = page.getByRole("button", { name: /New Scenario/ })
  await expect(tile).toBeVisible()
  await tile.hover()
  await expect.poll(() => tile.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none")
  await expect(tile.locator(".start-menu-icon")).toHaveCSS("transform", /matrix/)
})

test("landing menu honors reduced motion", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" })
  const page = await context.newPage()
  await page.goto("/")
  const tile = page.getByRole("button", { name: /New Scenario/ })
  await tile.hover()
  await expect(tile).toHaveCSS("transition-duration", "0s")
  await context.close()
})
