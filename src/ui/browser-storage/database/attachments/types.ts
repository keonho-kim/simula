/**
 * Purpose: Describe uploaded source metadata retained in browser storage.
 * Pattern: Data contract.
 * Usage: Shared by attachment read, list, and store operations.
 * Related: src/ui/browser-storage/database/attachments/store.ts, src/ui/browser-storage/database/attachments/list.ts
 */
export interface StoredAttachment {
  id: string
  name: string
  type: string
  size: number
  lastModified: number
}
