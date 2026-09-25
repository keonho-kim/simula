/**
 * Purpose: Upsert a draft's working copy without replacing its saved copy.
 * Pattern: Repository Query.
 * Usage: Called while editing a new scenario.
 * Related: src/ui/browser-storage/database/drafts/save.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import { drafts } from "../browser-schema"
import { browserOrm } from "../orm"

export async function writeWorkingDraft<T>(id: string, kind: string, value: T, ownerId?: string): Promise<void> {
  const valueJson = JSON.stringify(value), updatedAt = new Date().toISOString()
  await browserOrm.insert(drafts).values({ id, kind, ownerId: ownerId ?? null, valueJson,
    savedJson: null, updatedAt }).onConflictDoUpdate({ target: drafts.id, set: { valueJson, updatedAt } })
}
