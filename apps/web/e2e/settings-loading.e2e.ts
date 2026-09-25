/**
 * Purpose: Verify settings loading recovery and the labeled concurrency control.
 * Pattern: Browser workflow test.
 * Usage: bun run test:e2e -- apps/web/e2e/settings-loading.e2e.ts
 * Related: src/ui/components/settings/settings-dialog.tsx, src/ui/components/settings/role-settings-panel.tsx
 */
import { expect, test } from "./fixtures"

test("settings failures replace loading with an error and can be retried", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  let fail = true
  await page.route("**/api/settings/defaults", async (route) => {
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
  await page.route("**/api/settings/defaults", () => {})
  await page.goto("/")
  await page.getByRole("button", { name: "설정", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 15000 })
  await expect(dialog.getByText("설정을 불러오는 중...", { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: "다시 시도", exact: true })).toBeEnabled()
})

test("the concurrency setting is labeled and included in the saved payload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  let savedConcurrency: number | undefined
  await page.route("**/api/settings", async route => {
    if (route.request().method() !== "PUT") { await route.continue(); return }
    const payload = route.request().postDataJSON() as { settings: { concurrency: number } }
    savedConcurrency = payload.settings.concurrency
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "LLM settings" })
  await dialog.getByRole("button", { name: /Roles/ }).click()
  expect((await dialog.boundingBox())!.height).toBeLessThan(await page.evaluate(() => innerHeight))
  await expect(dialog.locator('[data-slot="scroll-area-viewport"]')).toHaveCount(0)
  expect(await dialog.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  await dialog.getByRole("spinbutton", { name: "Concurrent model calls" }).fill("3")
  await dialog.getByRole("textbox", { name: "Credentials passphrase" }).fill("unit-test-passphrase")
  await dialog.getByRole("button", { name: "Save settings" }).click()
  await expect(dialog).toBeHidden()
  expect(savedConcurrency).toBe(3)
})

test("edited settings ask before closing and remain over the scenario popup", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/")
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const scenario = page.getByRole("dialog", { name: "New Scenario" })
  await scenario.getByRole("button", { name: "Settings" }).click()
  const settings = page.getByRole("dialog", { name: "LLM settings" })
  await settings.getByRole("button", { name: /Roles/ }).click()
  await settings.getByRole("spinbutton", { name: "Concurrent model calls" }).fill("3")
  await settings.getByRole("button", { name: "Close" }).click()
  const confirm = page.getByRole("dialog", { name: "Save changes before closing?" })
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: "Continue editing" }).click()
  await expect(settings.getByRole("spinbutton", { name: "Concurrent model calls" })).toHaveValue("3")
  await settings.getByRole("button", { name: "Close" }).click()
  await confirm.getByRole("button", { name: "Discard and close" }).click()
  await expect(settings).toBeHidden()
  await expect(scenario).toBeVisible()
})
