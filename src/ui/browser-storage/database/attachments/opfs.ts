/**
 * Purpose: Open the browser-owned uploaded-source directory in OPFS.
 * Pattern: Storage adapter.
 * Usage: Called by attachment store, read, and delete operations.
 * Related: src/ui/browser-storage/database/attachments/store.ts, src/ui/browser-storage/database/attachments/delete.ts
 */
export const ATTACHMENT_DIRECTORY = "simula-uploads"

export async function attachmentDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(ATTACHMENT_DIRECTORY, { create: true })
}
