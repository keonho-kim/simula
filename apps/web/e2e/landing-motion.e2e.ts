/**
 * Purpose: Verify the unified scenario entry and landing menu motion.
 * Pattern: End-to-end visual behavior test.
 * Usage: Executed by Playwright through bun run test:e2e.
 * Related: src/ui/pages/start-screen.tsx, src/ui/animation/provider.tsx
 */
import { expect, test } from "./fixtures"

test("new scenario opens one modal and finished imports are the second landing action", async ({ page }) => {
  await page.goto("/")
  const tiles = page.locator(".start-menu-tile")
  await expect(tiles).toHaveCount(4)
  await expect(tiles.nth(1)).toContainText("Import finished scenario")
  await expect(page.getByRole("button", { name: /Create from documents|Upload My Scenario/ })).toHaveCount(0)
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const builder = page.getByRole("dialog", { name: "New Scenario" })
  await expect(builder.getByLabel("Choose files")).toBeAttached()
  await expect(builder.getByLabel("Situation to simulate · optional")).toBeVisible()
  await expect(builder.getByRole("button", { name: "Import finished scenario" })).toHaveCount(0)
})

test("landing menu uses lightweight transform motion", async ({ page }) => {
  await page.goto("/")
  const tile = page.getByRole("button", { name: /New Scenario/ })
  await expect(tile).toBeVisible()
  await tile.hover()
  await expect.poll(() => tile.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none")
  await expect(tile.locator(".start-menu-icon")).toHaveCSS("transform", /matrix/)
})

test("landing menu honors reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const tile = page.getByRole("button", { name: /New Scenario/ })
  await tile.hover()
  await expect(tile).toHaveCSS("transition-duration", "0s")
  await expect(tile).toHaveCSS("transform", "none")
})
