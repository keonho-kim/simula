/**
 * Purpose: Verify a finished-scenario popup keeps edits and resumes from browser storage.
 * Pattern: Browser editing workflow test.
 * Usage: bun run test:e2e apps/web/e2e/preview-draft.e2e.ts
 * Related: src/ui/components/scenario/scenario-preview-dialog.tsx, src/ui/browser-storage/database/drafts/save.ts
 */
import { expect, test } from "./fixtures"

test("finished scenario save and close survives refresh", async ({ page }) => {
  await page.goto("/")
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /Import finished scenario/ }).click()
  await (await chooser).setFiles({ name: "proposal.md", mimeType: "text/markdown", buffer: Buffer.from("# Proposal\nA team considers a launch.") })
  const preview = page.getByRole("dialog", { name: "Scenario Preview" })
  await preview.getByLabel("Max round").fill("5")
  await preview.getByRole("button", { name: "Close" }).click()
  const confirm = page.getByRole("dialog", { name: "Save changes before closing?" })
  await confirm.getByRole("button", { name: "Save and close" }).click()
  await expect(preview).toBeHidden()
  await page.reload()
  await page.getByRole("button", { name: "Resume saved draft" }).click()
  await expect(preview.getByLabel("Max round")).toHaveValue("5")
  await preview.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByRole("dialog", { name: "LLM settings" })).toBeVisible()
  await page.getByRole("dialog", { name: "LLM settings" }).getByRole("button", { name: "Close" }).click()
  await expect(preview).toBeVisible()
})
