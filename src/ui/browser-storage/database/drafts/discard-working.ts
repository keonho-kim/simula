/**
 * Purpose: Restore a saved draft or delete an unsaved draft atomically.
 * Pattern: Repository Transaction.
 * Usage: Called when an editor discards unsaved changes.
 * Related: src/ui/browser-storage/database/drafts/save.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import { and, eq, isNotNull, isNull } from "drizzle-orm"
import { drafts } from "../browser-schema"
import { browserOrm } from "../orm"

export async function discardWorkingDraft(id: string): Promise<void> {
  await browserOrm.batch([
    browserOrm.update(drafts).set({ valueJson: drafts.savedJson }).where(and(eq(drafts.id, id), isNotNull(drafts.savedJson))),
    browserOrm.delete(drafts).where(and(eq(drafts.id, id), isNull(drafts.savedJson))),
  ])
}
