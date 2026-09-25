/**
 * Purpose: Verify only one tab owns the browser database and an extra tab stays blocked.
 * Pattern: Browser lifecycle integration test.
 * Usage: bun run test:e2e apps/web/e2e/single-tab.e2e.ts
 * Related: src/ui/browser-storage/tab-ownership.ts, src/ui/pages/blocked-tab.tsx
 */
import { expect, test } from "./fixtures"

test("an extra tab is blocked and can request the running tab", async ({ context, page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "시뮬레이션 시작하기" })).toBeVisible()
  const extra = await context.newPage()
  await extra.goto("/")
  await expect(extra.getByRole("heading", { name: "이미 진행 중인 시뮬레이션이 있습니다" })).toBeVisible()
  await extra.getByRole("button", { name: "시뮬레이션으로 돌아가기" }).click()
  await expect(page.getByRole("heading", { name: "시뮬레이션 시작하기" })).toBeVisible()
  await extra.close()
})
