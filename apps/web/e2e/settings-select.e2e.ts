/**
 * Purpose: Verify unconfigured settings stay neutral and selected provider/model labels persist.
 * Pattern: Browser regression test.
 * Usage: Run with bun run test:e2e apps/web/e2e/settings-select.e2e.ts.
 * Related: src/ui/components/ui/select.tsx, src/ui/components/settings/role-settings-panel.tsx
 */
import { expect, test } from "./fixtures"

test("unconfigured roles do not discover models or show an initial error", async ({ page }) => {
  let discoveryRequests = 0
  await page.route("**/api/settings/models", route => { discoveryRequests++; return route.fulfill({ json: { models: [] } }) })
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "LLM settings" })
  await dialog.getByRole("button", { name: /Roles/ }).click()
  const provider = dialog.getByRole("combobox").first()
  await expect(provider).toContainText("Select a provider")
  await expect(dialog.getByText("Failed to load model list.")).toHaveCount(0)
  await provider.click()
  await page.getByRole("option", { name: "Gemini", exact: true }).click()
  await expect(provider).toContainText("Gemini")
  await expect(dialog.getByRole("combobox").nth(1)).toContainText("Configure this provider's connection first")
  await dialog.getByRole("tab", { name: "Planner" }).click()
  await expect(provider).toContainText("Select a provider")
  await dialog.getByRole("tab", { name: "StoryBuilder" }).click()
  await expect(provider).toContainText("Gemini")
  expect(discoveryRequests).toBe(0)
})

test("local provider and model remain readable after closing menus and changing tabs", async ({ page }) => {
  await page.route("**/api/settings/models", route => route.fulfill({ json: { models: ["ornith-test", "second-model"] } }))
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "LLM settings" })
  await dialog.getByRole("button", { name: /Roles/ }).click()
  const provider = dialog.getByRole("combobox").first()
  await provider.click()
  await page.getByRole("option", { name: "lmstudio", exact: true }).click()
  await expect(provider).toContainText("lmstudio")
  const model = dialog.getByRole("combobox").nth(1)
  await expect(model).toContainText("Select a model")
  await model.click()
  await page.getByRole("option", { name: "ornith-test", exact: true }).click()
  await expect(model).toContainText("ornith-test")
  await expect(page.getByRole("listbox")).toHaveCount(0)
  expect(await provider.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)")
  await dialog.getByRole("tab", { name: "Planner" }).click()
  await dialog.getByRole("tab", { name: "StoryBuilder" }).click()
  await expect(provider).toContainText("lmstudio")
  await expect(model).toContainText("ornith-test")
})
