/**
 * Purpose: Describe a browser draft's working and saved copies.
 * Pattern: Data contract.
 * Usage: Returned by the draft read query.
 * Related: src/ui/browser-storage/database/drafts/read.ts, src/ui/browser-storage/database/drafts/save.ts
 */
export interface StoredDraft<T> { working: T; saved?: T }
