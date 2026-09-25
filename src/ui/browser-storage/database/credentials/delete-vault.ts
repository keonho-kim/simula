/**
 * Purpose: Delete the encrypted provider-credentials row.
 * Pattern: Repository Query.
 * Usage: Called when the user resets their saved credentials.
 * Related: src/ui/browser-storage/database/credential-vault.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import { eq } from "drizzle-orm"
import { credentials } from "../browser-schema"
import { browserOrm } from "../orm"
import { VAULT_ID } from "./vault-id"

export async function deleteVault(): Promise<void> {
  await browserOrm.delete(credentials).where(eq(credentials.provider, VAULT_ID))
}
