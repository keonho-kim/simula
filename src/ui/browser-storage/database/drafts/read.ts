/**
 * Purpose: Read one draft's working and saved copies.
 * Pattern: Repository Query.
 * Usage: Called when reopening scenario or preview editing.
 * Related: src/ui/browser-storage/database/drafts/types.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import { eq } from "drizzle-orm"
import { drafts } from "../browser-schema"
import { browserOrm } from "../orm"
import type { StoredDraft } from "./types"

export async function readDraft<T>(id: string): Promise<StoredDraft<T> | undefined> {
  const [row] = await browserOrm.select({ valueJson: drafts.valueJson, savedJson: drafts.savedJson })
    .from(drafts).where(eq(drafts.id, id))
  return row ? { working: JSON.parse(row.valueJson) as T,
    ...(row.savedJson ? { saved: JSON.parse(row.savedJson) as T } : {}) } : undefined
}
