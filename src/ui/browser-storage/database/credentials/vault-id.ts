/**
 * Purpose: Identify the single encrypted provider-credentials row.
 * Pattern: Domain constant.
 * Usage: Shared by credential read, save, and delete queries.
 * Related: src/ui/browser-storage/database/credential-vault.ts, src/ui/browser-storage/database/browser-schema.ts
 */
export const VAULT_ID = "provider-credentials"
