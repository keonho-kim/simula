/**
 * Purpose: Delete one attachment's SQLite record and OPFS source.
 * Pattern: Storage operation.
 * Usage: Called when a draft upload is removed.
 * Related: src/ui/browser-storage/database/attachments/opfs.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import { eq } from "drizzle-orm"
import { attachments } from "../browser-schema"
import { browserOrm } from "../orm"
import { attachmentDirectory } from "./opfs"

export async function deleteAttachment(id: string): Promise<void> {
  await browserOrm.delete(attachments).where(eq(attachments.id, id))
  await (await attachmentDirectory()).removeEntry(id).catch(error => {
    if (!(error instanceof DOMException) || error.name !== "NotFoundError") throw error
  })
}
