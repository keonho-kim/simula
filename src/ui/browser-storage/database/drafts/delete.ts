/**
 * Purpose: Delete one saved browser editing draft.
 * Pattern: Repository Query.
 * Usage: Called after a draft is submitted or removed.
 * Related: src/ui/browser-storage/database/drafts/read.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import { eq } from "drizzle-orm"
import { drafts } from "../browser-schema"
import { browserOrm } from "../orm"

export async function deleteDraft(id: string): Promise<void> {
  await browserOrm.delete(drafts).where(eq(drafts.id, id))
}
