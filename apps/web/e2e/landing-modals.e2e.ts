/**
 * Purpose: Verify landing actions open bounded dialogs and no browser backup controls remain.
 * Pattern: Browser workflow contract test.
 * Usage: Run with bun run test:e2e apps/web/e2e/landing-modals.e2e.ts.
 * Related: src/ui/pages/start-screen.tsx, src/ui/styles/page-dialog.css, src/ui/styles/document-builder.css
 */
import { expect, test } from "./fixtures"

test("landing choices open centered modals over a dimmed background", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/")

  await expect(page.getByRole("button", { name: "브라우저 백업 내보내기" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "브라우저 백업 가져오기" })).toHaveCount(0)
  await expect(page.locator('input[accept*=".zip"]')).toHaveCount(0)

  for (const [button, title] of [
    ["새 시나리오", "새 시나리오"],
    ["예시 시나리오 실행", "예시 시나리오"],
    ["실행 내역 보기", "실행 내역"],
  ] as const) {
    await page.getByRole("button", { name: new RegExp(`^${button}`) }).click()
    const dialog = page.getByRole("dialog", { name: title })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThan(20)
    expect(box!.y).toBeGreaterThan(20)
    expect(box!.x + box!.width).toBeLessThan(1260)
    expect(box!.y + box!.height).toBeLessThan(780)
    const backdrop = await page.locator('[data-slot="dialog-overlay"]').last().evaluate(element => {
      const style = getComputedStyle(element)
      return { filter: style.backdropFilter, background: style.backgroundColor }
    })
    expect(backdrop.filter).toContain("blur(")
    expect(backdrop.background).not.toBe("rgba(0, 0, 0, 0)")
    await dialog.getByRole("button", { name: "닫기" }).click()
    await expect(dialog).toBeHidden()
  }
})
