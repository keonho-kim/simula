/**
 * Purpose: Verify encrypted browser settings unlock and transient server resynchronization.
 * Pattern: Browser credential workflow test.
 * Usage: bun run test:e2e apps/web/e2e/credential-settings.e2e.ts
 * Related: src/ui/pages/credential-gate.tsx, src/ui/browser-storage/database/credential-vault.ts
 */
import { expect, test } from "./fixtures"

test("saved model settings require an unlock after refresh without plaintext SQLite secrets", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const settings = page.getByRole("dialog", { name: "LLM settings" })
  await settings.locator('input[type="password"]').first().fill("unit-test-api-key")
  await settings.getByRole("textbox", { name: "Credentials passphrase" }).fill("long local passphrase")
  await settings.getByRole("button", { name: "Save settings" }).click()
  await expect(settings).toBeHidden()
  const raw = await page.evaluate(async () => {
    const moduleUrl = "/src/ui/browser-storage/database/connection.ts"
    const { browserDatabase } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/browser-storage/database/connection")
    return (await (await browserDatabase()).query<{ value_json: string }>({ sql: "SELECT value_json FROM settings WHERE id = 1" }))[0]?.value_json
  })
  expect(raw).not.toContain("unit-test-api-key")
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await expect(page.getByRole("heading", { name: "Unlock credentials" })).toBeVisible()
  await page.getByRole("textbox", { name: "Credentials passphrase" }).fill("wrong passphrase")
  await page.getByRole("button", { name: "Unlock credentials" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Check the passphrase" })).toBeVisible()
  await page.getByRole("textbox", { name: "Credentials passphrase" }).fill("long local passphrase")
  await page.getByRole("button", { name: "Unlock credentials" }).click()
  await expect(page.getByRole("heading", { name: "Start a simulation" })).toBeVisible()
  const { settings: current } = await (await page.request.get("/api/settings")).json()
  expect(current.providers.openai.apiKey).toBe("********")
})
