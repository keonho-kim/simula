/**
 * Purpose: Transfer one source's ownership from a draft to a document set.
 * Pattern: Repository Query.
 * Usage: Called after an uploaded document set is accepted.
 * Related: src/ui/browser-storage/database/browser-schema.ts, src/ui/browser-storage/database/attachments/list.ts
 */
import { eq } from "drizzle-orm"
import { attachments } from "../browser-schema"
import { browserOrm } from "../orm"

export async function retainDocumentAttachment(id: string, setId: string): Promise<void> {
  await browserOrm.update(attachments).set({ ownerKind: "document-set", ownerId: setId })
    .where(eq(attachments.id, id))
}
