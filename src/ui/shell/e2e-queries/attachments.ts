/**
 * Purpose: Expose separate attachment operations through one test-only browser import.
 * Pattern: Test adapter.
 * Usage: Loaded only by Playwright through e2e-modules.ts.
 * Related: src/ui/shell/e2e-modules.ts, src/ui/browser-storage/database/attachments/store.ts
 */
export { deleteAttachment } from "@/ui/browser-storage/database/attachments/delete"
export { listDocumentAttachments } from "@/ui/browser-storage/database/attachments/list"
export { readAttachment } from "@/ui/browser-storage/database/attachments/read"
export { retainDocumentAttachment } from "@/ui/browser-storage/database/attachments/retain"
export { storeAttachment } from "@/ui/browser-storage/database/attachments/store"
export type { StoredAttachment } from "@/ui/browser-storage/database/attachments/types"
