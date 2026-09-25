/**
 * Purpose: Verify a browser backup restores SQLite records and OPFS uploads.
 * Pattern: Browser workflow test.
 * Usage: bun run test:e2e apps/web/e2e/browser-backup.e2e.ts --project=chromium
 * Related: src/ui/browser-storage/backup.ts, src/ui/browser-storage/database/attachments/store.ts
 */
import { expect, test } from "./fixtures"

test("browser backup restores drafts and uploaded source files", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const result = await page.evaluate(async () => {
    const backupUrl = "/src/ui/browser-storage/backup.ts"
    const draftsUrl = "/src/ui/shell/e2e-queries/drafts.ts"
    const attachmentsUrl = "/src/ui/shell/e2e-queries/attachments.ts"
    const backup = await window.__simulaE2E!.import(backupUrl) as typeof import("@/ui/browser-storage/backup")
    const drafts = await window.__simulaE2E!.import(draftsUrl) as typeof import("@/ui/shell/e2e-queries/drafts")
    const attachments = await window.__simulaE2E!.import(attachmentsUrl) as typeof import("@/ui/shell/e2e-queries/attachments")
    const id = crypto.randomUUID()
    const attachment = await attachments.storeAttachment(new File(["source for backup"], "source.md", { type: "text/markdown" }))
    await drafts.saveDraft(id, "scenario", { attachment })
    const archive = await backup.exportBrowserBackup()
    await drafts.deleteDraft(id)
    await attachments.deleteAttachment(attachment.id)
    await backup.importBrowserBackup(new File([archive], "backup.zip", { type: "application/zip" }))
    const restored = await drafts.readDraft<{ attachment: typeof attachment }>(id)
    const file = restored?.saved && await attachments.readAttachment(restored.saved.attachment)
    return { size: archive.size, text: await file?.text() }
  })
  expect(result.size).toBeGreaterThan(100)
  expect(result.text).toBe("source for backup")
})

test("encrypted credentials remain encrypted and unlock after backup import", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const result = await page.evaluate(async () => {
    const backupUrl = "/src/ui/browser-storage/backup.ts", vaultUrl = "/src/ui/browser-storage/database/credential-vault.ts"
    const backup = await window.__simulaE2E!.import(backupUrl) as typeof import("@/ui/browser-storage/backup")
    const vault = await window.__simulaE2E!.import(vaultUrl) as typeof import("@/ui/browser-storage/database/credential-vault")
    await vault.createCredentialVault("portable passphrase", { openai: { apiKey: "backup-secret" } })
    const archive = await backup.exportBrowserBackup()
    await vault.clearCredentialVault()
    await backup.importBrowserBackup(new File([archive], "portable.zip"))
    const locked = vault.readUnlockedSecrets() === undefined
    const restored = await vault.unlockCredentialVault("portable passphrase")
    return { locked, key: restored.openai?.apiKey }
  })
  expect(result).toEqual({ locked: true, key: "backup-secret" })
})
