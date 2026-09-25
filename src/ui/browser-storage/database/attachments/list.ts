/**
 * Purpose: List a document set's retained source files in insertion order.
 * Pattern: Repository Query.
 * Usage: Called when resubmitting or reviewing a document set.
 * Related: src/ui/browser-storage/database/browser-schema.ts, src/ui/browser-storage/database/attachments/types.ts
 */
import { and, eq, sql } from "drizzle-orm"
import { attachments } from "../browser-schema"
import { browserOrm } from "../orm"
import type { StoredAttachment } from "./types"

export async function listDocumentAttachments(setId: string): Promise<StoredAttachment[]> {
  const rows = await browserOrm.select({ id: attachments.id, name: attachments.name,
    sizeBytes: attachments.sizeBytes, mimeType: attachments.mimeType,
    lastModified: attachments.lastModified }).from(attachments)
    .where(and(eq(attachments.ownerKind, "document-set"), eq(attachments.ownerId, setId)))
    .orderBy(sql`rowid`)
  return rows.map(row => ({ id: row.id, name: row.name, size: row.sizeBytes,
    type: row.mimeType, lastModified: row.lastModified }))
}
