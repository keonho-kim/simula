/**
 * Purpose: Verify long work opens as a page while short selections remain bounded dialogs.
 * Pattern: Browser navigation contract test.
 * Usage: bun run test:e2e landing-modals.e2e.ts
 * Related: src/ui/pages/start-screen.tsx, src/ui/pages/scenario-input-page.tsx
 */
import { expect, test } from "./fixtures"

test("source entry is a page and example/history selectors remain dialogs", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/")
  await page.getByRole("button", { name: /^새 시나리오/ }).click()
  await expect(page.getByRole("main", { name: "새 시나리오" })).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "돌아가기", exact: true }).click()
  for (const [button, title] of [["예시 시나리오 실행", "예시 시나리오"], ["실행 내역 보기", "실행 내역"]] as const) {
    await page.getByRole("button", { name: new RegExp(`^${button}`) }).click()
    const dialog = page.getByRole("dialog", { name: title })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box!.x).toBeGreaterThan(20)
    expect(box!.x + box!.width).toBeLessThan(1260)
    await dialog.getByRole("button", { name: "닫기" }).click()
    await expect(dialog).toBeHidden()
  }
})
