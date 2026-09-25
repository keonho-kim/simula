/**
 * Purpose: Atomically retain immutable evidence and call records for a selected source revision.
 * Pattern: Repository artifact operations.
 * Usage: DocumentStore invokes capture while holding its document-set write lock.
 * Related: src/backend/storage/documents/document-store.ts, src/shared/documents.ts
 */
import { link, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { DocumentSet } from "@/shared/documents"
import { DocumentError, parseDocumentSet } from "@/backend/core/documents/validation"
import { isMissingFileError } from "@/backend/storage/file-errors"
import { MAX_MANIFEST_BYTES, MAX_DOCUMENT_METRICS_BYTES, MAX_EXTRACTION_BYTES } from "./documents.constants"

export function sourceRevisionDirectory(setDirectory: string, revision: number): string {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new DocumentError("invalid_source_revision", "Provide a nonnegative source revision.")
  return join(setDirectory, "revisions", String(revision))
}

export async function readSourceRevision(setDirectory: string, setId: string, revision: number): Promise<DocumentSet | undefined> {
  const path = join(sourceRevisionDirectory(setDirectory, revision), "manifest.json")
  let body: string
  try {
    if ((await stat(path)).size > MAX_MANIFEST_BYTES) throw new DocumentError("artifact_too_large", "Source revision exceeds the read limit.", 413)
    body = await readFile(path, "utf8")
  } catch (error) { if (isMissingFileError(error)) return undefined; throw error }
  const set = parseDocumentSet(JSON.parse(body))
  if (set.id !== setId || set.revision !== revision) throw new DocumentError("invalid_manifest", "Source revision identity does not match.", 500)
  return set
}

export async function captureSourceRevision(setDirectory: string, set: DocumentSet): Promise<void> {
  const target = sourceRevisionDirectory(setDirectory, set.revision)
  const temporary = `${target}.${crypto.randomUUID()}.tmp`
  await mkdir(join(setDirectory, "revisions"), { recursive: true })
  await mkdir(temporary)
  try {
    for (const document of set.documents) {
      const source = join(setDirectory, document.id)
      const destination = join(temporary, document.id)
      await mkdir(destination)
      if ((await stat(join(source, "evidence.json"))).size > MAX_EXTRACTION_BYTES) {
        throw new DocumentError("artifact_too_large", "Source evidence exceeds the read limit.", 413)
      }
      // Current evidence is replaced by atomic rename, never edited in place. The
      // hard link therefore retains its exact bytes without copying large evidence.
      await link(join(source, "evidence.json"), join(destination, "evidence.json"))
      // Call logs are append-only, so copy their bounded contents instead of linking.
      try {
        const path = join(source, "metrics.jsonl")
        if ((await stat(path)).size > MAX_DOCUMENT_METRICS_BYTES) throw new Error("Document model-call history exceeded its limit.")
        await writeFile(join(destination, "metrics.jsonl"), await readFile(path), { flag: "wx" })
      } catch (error) { if (!isMissingFileError(error)) throw error }
    }
    await writeFile(join(temporary, "manifest.json"), JSON.stringify(set), { flag: "wx" })
    try { await rename(temporary, target) }
    catch (error) {
      if (!(error instanceof Error) || !("code" in error) || !["EEXIST", "ENOTEMPTY"].includes(String(error.code))) throw error
      const existing = await readSourceRevision(setDirectory, set.id, set.revision)
      if (JSON.stringify(existing) !== JSON.stringify(set)) throw new Error("Source revision was already captured with different metadata.", { cause: error })
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
