/**
 * Purpose: Handle bounded uploads, document extraction controls, and evidence retrieval.
 * Pattern: HTTP controller.
 * Usage: Dispatched for /api/documents by the API router.
 * Related: src/backend/runtime/documents.ts, src/backend/storage/documents/document-store.ts
 */
import { DocumentError } from "@/backend/core/documents/validation"
import { MAX_DOCUMENT_BYTES } from "@/shared/documents-schema"
import type { DocumentStore } from "@/backend/storage/documents/document-store"
import type { DocumentJobs } from "@/backend/runtime/documents"
import { json } from "../responses"

const MAX_UPLOAD_BODY_BYTES = MAX_DOCUMENT_BYTES + 64 * 1024
const EVIDENCE_PAGE_SIZE = 100

export async function routeDocuments(store: DocumentStore, jobs: DocumentJobs, request: Request, url: URL): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean)
  try {
    if (parts.length === 2 && request.method === "POST") return json({ documentSet: await store.createSet() }, { status: 201 })
    const setId = parts[2]
    if (!setId) return json({ error: "Not found" }, { status: 404 })
    if (parts.length === 3 && request.method === "GET") {
      const set = await store.readSet(setId)
      return json({ documentSet: { ...set, documents: set.documents.map(document => document.status === "processing" && !jobs.isActive(setId, document.id)
        ? { ...document, status: "failed", issue: { code: "extraction_interrupted", message: "Extraction was interrupted; retry this document." } }
        : document) } })
    }
    if (parts[3] !== "files") return json({ error: "Not found" }, { status: 404 })
    if (parts.length === 4 && request.method === "POST") {
      await store.readSet(setId)
      const form = await readUpload(request)
      const files = form.getAll("file")
      if (files.length !== 1 || !(files[0] instanceof File)) throw new DocumentError("invalid_upload", "Upload one file per request.")
      const file = files[0]
      return json({ document: await store.addFile(setId, file.name, new Uint8Array(await file.arrayBuffer())) }, { status: 201 })
    }
    const documentId = parts[4]
    if (!documentId) return json({ error: "Not found" }, { status: 404 })
    if (parts.length === 6 && parts[5] === "extract" && request.method === "POST") {
      await store.readDocument(setId, documentId)
      const fastMode = (await request.json().catch(() => ({})) as { fastMode?: unknown }).fastMode
      if (fastMode !== undefined && typeof fastMode !== "boolean") throw new DocumentError("invalid_extraction_mode", "fastMode must be a boolean.")
      const job = jobs.start(setId, documentId, fastMode === true)
      void job.completion.catch(() => console.error("Document extraction persistence failed", { setId, documentId }))
      return json({ status: job.alreadyRunning ? "already_running" : "started" }, { status: 202 })
    }
    if (parts.length === 6 && parts[5] === "cancel" && request.method === "POST") {
      await store.readDocument(setId, documentId)
      return json({ status: jobs.cancel(setId, documentId) ? "canceling" : "not_active" })
    }
    if (parts.length === 6 && parts[5] === "evidence" && request.method === "GET") {
      const ids = url.searchParams.getAll("id")
      if (ids.length) {
        if (ids.length !== 1 || !ids[0] || ids[0].length > 240 || url.searchParams.has("offset")) {
          throw new DocumentError("invalid_evidence_id", "Provide one evidence ID without an offset.")
        }
        const revisions = url.searchParams.getAll("revision")
        const revision = Number(revisions[0])
        if (revisions.length !== 1 || !/^\d+$/.test(revisions[0]) || !Number.isSafeInteger(revision)) {
          throw new DocumentError("invalid_evidence_revision", "Provide one nonnegative source revision.")
        }
        const evidence = await store.readExtraction(setId, documentId, revision)
        const block = evidence.blocks.find(value => value.id === ids[0])
        if (!block) throw new DocumentError("evidence_not_found", "Evidence not found in this document.", 404)
        return json({ block })
      }
      const offset = Number(url.searchParams.get("offset") ?? 0)
      if (!Number.isSafeInteger(offset) || offset < 0) throw new DocumentError("invalid_offset", "Offset must be a nonnegative integer.")
      const evidence = await store.readExtraction(setId, documentId)
      return json({ blocks: evidence.blocks.slice(offset, offset + EVIDENCE_PAGE_SIZE), coverage: evidence.coverage,
        issues: evidence.issues, nextOffset: offset + EVIDENCE_PAGE_SIZE < evidence.blocks.length ? offset + EVIDENCE_PAGE_SIZE : null })
    }
    return json({ error: "Not found" }, { status: 404 })
  } catch (error) {
    if (error instanceof DocumentError) return json({ code: error.code, error: error.message }, { status: error.status })
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return json({ code: "document_not_found", error: "Document not found." }, { status: 404 })
    return json({ code: "document_request_failed", error: "Document request failed." }, { status: 500 })
  }
}

async function readUpload(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.startsWith("multipart/form-data;")) throw new DocumentError("invalid_upload", "Use multipart form data.")
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BODY_BYTES) throw new DocumentError("upload_too_large", "Upload body exceeds 20 MiB plus form overhead.", 413)
  const reader = request.body?.getReader()
  if (!reader) throw new DocumentError("invalid_upload", "The upload is empty.")
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_UPLOAD_BODY_BYTES) { await reader.cancel(); throw new DocumentError("upload_too_large", "Upload body exceeds the byte limit.", 413) }
      chunks.push(new Uint8Array(value))
    }
  } finally { reader.releaseLock() }
  try { return await new Response(new Blob(chunks), { headers: { "content-type": contentType } }).formData() }
  catch { throw new DocumentError("invalid_upload", "The upload form is malformed.") }
}
