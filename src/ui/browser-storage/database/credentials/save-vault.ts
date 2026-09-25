/**
 * Purpose: Upsert encrypted provider credentials and their random salt and nonce.
 * Pattern: Repository Query.
 * Usage: Called after browser Web Crypto encrypts the credentials.
 * Related: src/ui/browser-storage/database/credential-vault.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import { credentials } from "../browser-schema"
import { browserOrm } from "../orm"
import type { VaultRow } from "./read-vault"
import { VAULT_ID } from "./vault-id"

export async function saveVault(value: VaultRow): Promise<void> {
  await browserOrm.insert(credentials).values({ provider: VAULT_ID, ...value })
    .onConflictDoUpdate({ target: credentials.provider, set: value })
}
