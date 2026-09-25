/**
 * Purpose: Store one uploaded source in OPFS and insert its SQLite ownership record.
 * Pattern: Storage operation.
 * Usage: Called before the new-scenario draft starts extraction.
 * Related: src/ui/browser-storage/database/attachments/opfs.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import { MAX_DOCUMENT_BYTES } from "@/shared/documents-schema"
import { attachments } from "../browser-schema"
import { browserOrm } from "../orm"
import { ATTACHMENT_DIRECTORY, attachmentDirectory } from "./opfs"
import type { StoredAttachment } from "./types"

export async function storeAttachment(file: File): Promise<StoredAttachment> {
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("Source file exceeds 20 MiB.")
  const id = crypto.randomUUID()
  const parent = await attachmentDirectory()
  const handle = await parent.getFileHandle(id, { create: true })
  try {
    const writer = await handle.createWritable()
    await file.stream().pipeTo(writer)
    await browserOrm.insert(attachments).values({ id, ownerKind: "draft", ownerId: "new-scenario",
      opfsPath: `${ATTACHMENT_DIRECTORY}/${id}`, name: file.name, sizeBytes: file.size,
      mimeType: file.type, lastModified: file.lastModified })
    return { id, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified }
  } catch (error) {
    await parent.removeEntry(id).catch(() => undefined)
    throw error
  }
}
