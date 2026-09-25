/**
 * Purpose: Expose separate draft queries through one test-only browser import.
 * Pattern: Test adapter.
 * Usage: Loaded only by Playwright through e2e-modules.ts.
 * Related: src/ui/shell/e2e-modules.ts, src/ui/browser-storage/database/drafts/read.ts
 */
export { deleteDraft } from "@/ui/browser-storage/database/drafts/delete"
export { discardWorkingDraft } from "@/ui/browser-storage/database/drafts/discard-working"
export { readDraft } from "@/ui/browser-storage/database/drafts/read"
export { saveDraft } from "@/ui/browser-storage/database/drafts/save"
export { writeWorkingDraft } from "@/ui/browser-storage/database/drafts/write-working"
export type { StoredDraft } from "@/ui/browser-storage/database/drafts/types"
