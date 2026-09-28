/**
 * Purpose: Verify selected setting labels stay visible after the dropdown closes and roles change.
 * Pattern: Browser regression test.
 * Usage: Run with bun run test:e2e apps/web/e2e/settings-select.e2e.ts.
 * Related: src/ui/components/ui/select.tsx, src/ui/components/settings/role-settings-panel.tsx
 */
import { expect, test } from "./fixtures"

test("role provider labels remain visible after selection and tab changes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "LLM settings" })
  await dialog.getByRole("button", { name: /Roles/ }).click()
  await dialog.getByRole("tab", { name: "StoryBuilder" }).click()

  const provider = dialog.getByRole("combobox").first()
  await expect(provider).toContainText("OpenAI")
  await provider.click()
  await page.getByRole("option", { name: "Gemini" }).click()
  await expect(provider).toContainText("Gemini")

  await dialog.getByRole("tab", { name: "Planner" }).click()
  await expect(provider).toContainText("OpenAI")
  await dialog.getByRole("tab", { name: "StoryBuilder" }).click()
  await expect(provider).toContainText("Gemini")
})
