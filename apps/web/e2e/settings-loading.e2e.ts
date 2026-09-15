import { expect, test } from "@playwright/test"

test("settings failures replace loading with an error and can be retried", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  let fail = true
  await page.route("**/api/settings", async (route) => {
    if (fail) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Settings backend unavailable" }) })
    else await route.continue()
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "LLM settings" })
  await expect(dialog.getByRole("alert")).toBeVisible()
  await expect(dialog.getByText("Loading settings...", { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: "Save settings", exact: true })).toBeDisabled()
  fail = false
  await dialog.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Save settings", exact: true })).toBeEnabled()
  await expect(dialog.getByRole("alert")).toHaveCount(0)
})


test("a stalled settings request times out instead of loading forever", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  await page.route("**/api/settings", () => {})
  await page.goto("/")
  await page.getByRole("button", { name: "설정", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 15000 })
  await expect(dialog.getByText("설정을 불러오는 중...", { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: "다시 시도", exact: true })).toBeEnabled()
})
