/**
 * Purpose: Commit one draft value as both working and saved copies.
 * Pattern: Repository Query.
 * Usage: Called by the editor's Save and Close action.
 * Related: src/ui/browser-storage/database/drafts/write-working.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import { drafts } from "../browser-schema"
import { browserOrm } from "../orm"

export async function saveDraft<T>(id: string, kind: string, value: T, ownerId?: string): Promise<void> {
  const valueJson = JSON.stringify(value), updatedAt = new Date().toISOString()
  await browserOrm.insert(drafts).values({ id, kind, ownerId: ownerId ?? null, valueJson,
    savedJson: valueJson, updatedAt }).onConflictDoUpdate({ target: drafts.id,
    set: { valueJson, savedJson: valueJson, updatedAt } })
}
