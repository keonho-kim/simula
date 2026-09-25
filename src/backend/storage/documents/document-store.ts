/**
 * Purpose: Persist document sets, original uploads, and validated evidence under one data root.
 * Pattern: Repository.
 * Usage: Instantiated by backend composition and called by document runtime/API.
 * Related: src/backend/core/documents/validation.ts, src/shared/generation-metrics-schema.ts
 */
import { captureSourceRevision, readSourceRevision, sourceRevisionDirectory } from "./source-revisions"
import { MAX_MANIFEST_BYTES, MAX_EXTRACTION_BYTES, MAX_DOCUMENT_METRICS_BYTES } from "./documents.constants"
import { createHash } from "node:crypto"
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import type { DocumentExtraction, DocumentRecord, DocumentSet } from "@/shared/documents"
import type { ModelMetrics } from "@/shared/run"
import { documentMetricCallSchema } from "@/shared/generation-metrics-schema"
import { modelCallFailureRecordSchema, type ModelCallFailure } from "@/shared/model-failure"
import { assertDocumentId, DocumentError, parseDocumentFormat, parseDocumentSet, parseExtraction } from "@/backend/core/documents/validation"
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENTS_PER_SET } from "@/shared/documents-schema"
import { appendModelCallRecord, parseModelCallLog } from "@/backend/storage/generation/model-call-log"
import { isMissingFileError } from "@/backend/storage/file-errors"

export class DocumentStore {
  readonly rootDir: string
  private readonly pending = new Map<string, Promise<void>>()

  constructor(rootDir: string) { this.rootDir = resolve(rootDir) }

  async createSet(): Promise<DocumentSet> {
    const set: DocumentSet = { id: crypto.randomUUID(), revision: 0, createdAt: new Date().toISOString(), documents: [] }
    await mkdir(this.setDir(set.id), { recursive: true })
    await this.writeSet(set)
    return set
  }

  async captureRevision(setId: string, revision: number): Promise<DocumentSet> {
    return this.lock(setId, async () => {
      const directory = this.setDir(setId)
      const existing = await readSourceRevision(directory, setId, revision)
      if (existing) return existing
      const set = await this.readSet(setId)
      if (set.revision !== revision) throw new DocumentError("source_revision_changed", "Source documents changed; reload before generating a scenario.", 409)
      if (!set.documents.length || set.documents.some(document => document.status !== "ready" && document.status !== "partial")) {
        throw new DocumentError("evidence_unavailable", "Extract every source document before capturing this revision.", 409)
      }
      await captureSourceRevision(directory, set)
      return set
    })
  }

  async readSet(setId: string, revision?: number): Promise<DocumentSet> {
    if (revision !== undefined) {
      const set = await readSourceRevision(this.setDir(setId), setId, revision)
      if (!set) throw new DocumentError("source_revision_unavailable", "The requested source revision was not retained; regenerate from the current source documents.", 409)
      return set
    }
    const set = parseDocumentSet(await this.readJson(join(this.setDir(setId), "manifest.json"), MAX_MANIFEST_BYTES))
    if (set.id !== setId) throw new DocumentError("invalid_manifest", "Document manifest identity does not match.", 500)
    return set
  }

  async addFile(setId: string, name: string, bytes: Uint8Array): Promise<DocumentRecord> {
    const format = parseDocumentFormat(name)
    if (!bytes.byteLength || bytes.byteLength > MAX_DOCUMENT_BYTES) throw new DocumentError("document_too_large", "Upload a non-empty document no larger than 20 MiB.", 413)
    return this.lock(setId, async () => {
      const set = await this.readSet(setId)
      if (set.documents.length >= MAX_DOCUMENTS_PER_SET) throw new DocumentError("too_many_documents", "A document set supports at most 20 files.", 413)
      const document: DocumentRecord = {
        id: crypto.randomUUID(), name, format, sizeBytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"), createdAt: new Date().toISOString(), status: "uploaded",
      }
      const directory = this.documentDir(setId, document.id)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, `original.${format}`), bytes, { flag: "wx" })
      await writeFile(join(directory, "metrics.jsonl"), "", { flag: "wx" })
      await this.writeSet({ ...set, revision: set.revision + 1, documents: [...set.documents, document] })
      return document
    })
  }

  async readDocument(setId: string, documentId: string, revision?: number): Promise<DocumentRecord> {
    assertDocumentId(documentId)
    const record = (await this.readSet(setId, revision)).documents.find(document => document.id === documentId)
    if (!record) throw new DocumentError("document_not_found", "Document not found in this set.", 404)
    return record
  }

  async originalPath(setId: string, documentId: string): Promise<string> {
    const document = await this.readDocument(setId, documentId)
    return join(this.documentDir(setId, documentId), `original.${document.format}`)
  }

  async readOriginal(setId: string, documentId: string): Promise<Uint8Array> {
    const path = await this.originalPath(setId, documentId)
    if ((await stat(path)).size > MAX_DOCUMENT_BYTES) throw new DocumentError("document_too_large", "Stored document exceeds the size limit.", 413)
    return new Uint8Array(await readFile(path))
  }

  async updateStatus(setId: string, documentId: string, status: "processing" | "canceled" | "failed", issue?: { code: string; message: string }): Promise<void> {
    await this.lock(setId, async () => {
      const set = await this.readSet(setId)
      const document = await this.readDocument(setId, documentId)
      const { id, name, format, sizeBytes, sha256, createdAt } = document
      const base = { id, name, format, sizeBytes, sha256, createdAt }
      const next: DocumentRecord = status === "failed"
        ? { ...base, status, issue: issue ?? { code: "extraction_failed", message: "Document extraction failed." } }
        : { ...base, status }
      await this.writeSet({ ...set, revision: set.revision + 1, documents: set.documents.map(value => value.id === documentId ? next : value) })
    })
  }

  async saveExtraction(setId: string, documentId: string, value: DocumentExtraction): Promise<void> {
    const extraction = parseExtraction(value, documentId)
    await this.lock(setId, async () => {
      const set = await this.readSet(setId)
      const document = await this.readDocument(setId, documentId)
      const { id, name, format, sizeBytes, sha256, createdAt } = document
      await this.writeJson(join(this.documentDir(setId, documentId), "evidence.json"), extraction)
      const partial = Boolean(extraction.coverage.skippedUnits || extraction.coverage.failedUnits)
      const issue = extraction.issues[0]
      const next: DocumentRecord = { id, name, format, sizeBytes, sha256, createdAt,
        status: partial ? "partial" : "ready", coverage: extraction.coverage, blockCount: extraction.blocks.length,
        ...(partial && issue ? { issue } : {}) }
      await this.writeSet({ ...set, revision: set.revision + 1, documents: set.documents.map(value => value.id === documentId ? next : value) })
    })
  }

  async readExtraction(setId: string, documentId: string, revision?: number): Promise<DocumentExtraction> {
    const document = await this.readDocument(setId, documentId, revision)
    if (document.status !== "ready" && document.status !== "partial") throw new DocumentError("evidence_unavailable", "Document extraction is not ready.", 409)
    return parseExtraction(await this.readJson(join(this.evidenceDirectory(setId, documentId, revision), "evidence.json"), MAX_EXTRACTION_BYTES), documentId)
  }

  async appendMetrics(setId: string, documentId: string, page: number, metrics: ModelMetrics): Promise<void> {
    const path = join(this.documentDir(setId, documentId), "metrics.jsonl")
    const value = documentMetricCallSchema.parse({ timestamp: new Date().toISOString(), page, metrics })
    await appendModelCallRecord(path, value, MAX_DOCUMENT_METRICS_BYTES)
  }

  async appendFailure(setId: string, documentId: string, failure: ModelCallFailure): Promise<void> {
    const path = join(this.documentDir(setId, documentId), "metrics.jsonl")
    const value = modelCallFailureRecordSchema.parse({ timestamp: new Date().toISOString(), failure })
    await appendModelCallRecord(path, value, MAX_DOCUMENT_METRICS_BYTES)
  }

  async readCallRecords(setId: string, documentId: string, revision?: number) {
    await this.readDocument(setId, documentId, revision)
    const path = join(this.evidenceDirectory(setId, documentId, revision), "metrics.jsonl")
    try {
      if ((await stat(path)).size > MAX_DOCUMENT_METRICS_BYTES) throw new Error("Document model-call history exceeded its limit.")
      return parseModelCallLog(await readFile(path, "utf8"), documentMetricCallSchema)
    } catch (error) { if (isMissingFileError(error)) return undefined; throw error }
  }

  private evidenceDirectory(setId: string, documentId: string, revision?: number): string {
    assertDocumentId(documentId)
    return revision === undefined ? this.documentDir(setId, documentId) : join(sourceRevisionDirectory(this.setDir(setId), revision), documentId)
  }

  private setDir(id: string): string { assertDocumentId(id); return join(this.rootDir, id) }
  private documentDir(setId: string, id: string): string { assertDocumentId(id); return join(this.setDir(setId), id) }
  private async writeSet(set: DocumentSet): Promise<void> { await this.writeJson(join(this.setDir(set.id), "manifest.json"), parseDocumentSet(set)) }

  private async readJson(path: string, maximum: number): Promise<unknown> {
    if ((await stat(path)).size > maximum) throw new DocumentError("artifact_too_large", "Document artifact exceeds the read limit.", 413)
    return JSON.parse(await readFile(path, "utf8"))
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    const temporary = `${path}.${crypto.randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(value), { flag: "wx" })
    await rename(temporary, path)
  }

  private async lock<T>(setId: string, work: () => Promise<T>): Promise<T> {
    assertDocumentId(setId)
    const previous = this.pending.get(setId) ?? Promise.resolve()
    const gate = Promise.withResolvers<void>()
    const tail = previous.then(() => gate.promise)
    this.pending.set(setId, tail)
    await previous
    try { return await work() }
    finally { gate.resolve(); if (this.pending.get(setId) === tail) this.pending.delete(setId) }
  }
}
