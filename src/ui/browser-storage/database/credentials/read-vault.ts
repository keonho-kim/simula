/**
 * Purpose: Read encrypted provider credentials without decrypting them.
 * Pattern: Repository Query.
 * Usage: Called by the credential vault before unlock or creation.
 * Related: src/ui/browser-storage/database/credential-vault.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import { eq } from "drizzle-orm"
import { credentials } from "../browser-schema"
import { browserOrm } from "../orm"
import { VAULT_ID } from "./vault-id"

export interface VaultRow { salt: Uint8Array; nonce: Uint8Array; ciphertext: Uint8Array }

export async function readVault(): Promise<VaultRow | undefined> {
  const [row] = await browserOrm.select({ salt: credentials.salt, nonce: credentials.nonce,
    ciphertext: credentials.ciphertext }).from(credentials).where(eq(credentials.provider, VAULT_ID))
  return row
}
