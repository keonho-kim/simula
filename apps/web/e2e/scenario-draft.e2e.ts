/**
 * Purpose: Verify selected files and context survive modal closing and browser reload.
 * Pattern: Browser draft persistence test.
 * Usage: bun run test:e2e apps/web/e2e/scenario-draft.e2e.ts
 * Related: src/ui/hooks/use-document-scenario.ts, src/ui/browser-storage/database/attachments/store.ts
 */
import { expect, test } from "./fixtures"

test("new scenario retains its file and context without starting extraction", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  let uploads = 0
  page.on("request", request => { if (request.method() === "POST" && request.url().includes("/api/documents")) uploads++ })
  await page.goto("/")
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const builder = page.getByRole("dialog", { name: "New Scenario" })
  await builder.getByLabel("Choose files").setInputFiles({ name: "brief.md", mimeType: "text/markdown", buffer: Buffer.from("# Brief\nA decision is due.") })
  await expect(builder.getByText("brief.md")).toBeVisible()
  await builder.getByLabel("Situation to simulate · optional").fill("Review the launch at a meeting.")
  await builder.getByRole("button", { name: "Close" }).click()
  const confirm = page.getByRole("dialog", { name: "Save changes before closing?" })
  await confirm.getByRole("button", { name: "Save and close" }).click()
  await page.reload()
  await page.getByRole("button", { name: /New Scenario/ }).click()
  await expect(builder.getByText("brief.md")).toBeVisible()
  await expect(builder.getByLabel("Situation to simulate · optional")).toHaveValue("Review the launch at a meeting.")
  expect(uploads).toBe(0)
})
