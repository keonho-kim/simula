/**
 * Purpose: Reopen and verify one uploaded source from OPFS.
 * Pattern: Storage operation.
 * Usage: Called when a draft or document set is submitted again.
 * Related: src/ui/browser-storage/database/attachments/opfs.ts, src/ui/browser-storage/database/attachments/types.ts
 */
import { attachmentDirectory } from "./opfs"
import type { StoredAttachment } from "./types"

export async function readAttachment(value: StoredAttachment): Promise<File> {
  const handle = await (await attachmentDirectory()).getFileHandle(value.id)
  const stored = await handle.getFile()
  if (stored.size !== value.size) throw new Error("A saved source file is incomplete.")
  return new File([stored], value.name, { type: value.type, lastModified: value.lastModified })
}
