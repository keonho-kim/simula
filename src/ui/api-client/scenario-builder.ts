/**
 * Purpose: Transport document uploads and shared scenario-build operations.
 * Pattern: Browser HTTP adapter with response parsing.
 * Usage: Called by the document scenario lifecycle hooks.
 * Related: src/shared/documents-schema.ts, src/shared/scenario-builder-schema.ts
 */
import { z } from "zod"
import type { BuilderRequest } from "@/shared/scenario-builder"
import { buildRecordSchema } from "@/shared/scenario-builder-schema"
import { documentSchema, evidenceBlockSchema, setSchema } from "@/shared/documents-schema"
import { RequestJsonError, requestJson as request, unavailableServerArtifact } from "./request-json"
import { readBrowserArtifact } from "@/ui/browser-storage/database/artifacts/read"
import { saveBrowserArtifact } from "@/ui/browser-storage/database/artifacts/save"

const UPLOAD_TIMEOUT_MS = 120_000

export async function createDocumentSet() {
  const set = z.object({ documentSet: setSchema }).parse(await request("/api/documents", { method: "POST" })).documentSet
  return saveBrowserArtifact("document-set", set.id, set.id, "created", set)
}

export async function fetchDocumentSet(id: string, signal?: AbortSignal) {
  try {
    const set = z.object({ documentSet: setSchema }).parse(await request(`/api/documents/${encodeURIComponent(id)}`, { signal })).documentSet
    return saveBrowserArtifact("document-set", set.id, set.id, "ready", set)
  } catch (error) {
    if (!unavailableServerArtifact(error)) throw error
    const saved = await readBrowserArtifact<z.infer<typeof setSchema>>("document-set", id)
    if (!saved) throw error
    if (error instanceof RequestJsonError && saved.documents.some(document => document.status === "processing")) {
      const interrupted = setSchema.parse({ ...saved, documents: saved.documents.map(document => document.status === "processing"
        ? { ...document, status: "failed", issue: { code: "extraction_interrupted", message: "The server stopped during extraction." } } : document) })
      return saveBrowserArtifact("document-set", id, id, "interrupted", interrupted)
    }
    return saved
  }
}

export async function hasActiveDocumentSet(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, { signal })
  if (response.status === 404) return false
  if (!response.ok) throw new Error(`Document set check failed (${response.status}).`)
  return true
}

export async function uploadDocument(setId: string, file: File, signal: AbortSignal) {
  const body = new FormData()
  body.set("file", file)
  return z.object({ document: documentSchema }).parse(await request(`/api/documents/${encodeURIComponent(setId)}/files`, {
    method: "POST", body, signal,
  }, UPLOAD_TIMEOUT_MS)).document
}

export async function controlDocument(setId: string, documentId: string, action: "extract" | "cancel", fastMode = false) {
  await request(`/api/documents/${encodeURIComponent(setId)}/files/${encodeURIComponent(documentId)}/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fastMode }),
  })
}

export async function fetchEvidenceBlock(setId: string, documentId: string, evidenceId: string, revision: number, signal?: AbortSignal) {
  const path = `/api/documents/${encodeURIComponent(setId)}/files/${encodeURIComponent(documentId)}/evidence?id=${encodeURIComponent(evidenceId)}&revision=${revision}`
  const key = `${setId}:${documentId}:${revision}:${evidenceId}`
  try {
    const block = z.object({ block: evidenceBlockSchema }).parse(await request(path, { signal })).block
    return saveBrowserArtifact("evidence-block", key, setId, "ready", block)
  } catch (error) {
    if (!unavailableServerArtifact(error)) throw error
    const saved = await readBrowserArtifact<z.infer<typeof evidenceBlockSchema>>("evidence-block", key)
    if (!saved) throw error
    return saved
  }
}

export async function startScenarioBuild(input: BuilderRequest, id: string) {
  const build = z.object({ build: buildRecordSchema }).parse(await request("/api/scenario-builder", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": id }, body: JSON.stringify(input),
  })).build
  return saveBrowserArtifact("build", build.id, input.documentSetId, build.status, build)
}

export async function fetchScenarioBuild(id: string, signal?: AbortSignal) {
  try {
    const build = z.object({ build: buildRecordSchema }).parse(await request(`/api/scenario-builder/${encodeURIComponent(id)}`, { signal })).build
    return saveBrowserArtifact("build", build.id, build.request.documentSetId, build.status, build)
  } catch (error) {
    if (!unavailableServerArtifact(error)) throw error
    const saved = await readBrowserArtifact<z.infer<typeof buildRecordSchema>>("build", id)
    if (!saved) throw error
    if (error instanceof RequestJsonError && saved.status === "running") {
      const interrupted = buildRecordSchema.parse({ ...saved, status: "failed", issue: "Scenario generation was interrupted by a server restart." })
      return saveBrowserArtifact("build", id, saved.request.documentSetId, interrupted.status, interrupted)
    }
    return saved
  }
}

export async function controlScenarioBuild(id: string, action: "retry" | "cancel" | "confirm") {
  await request(`/api/scenario-builder/${encodeURIComponent(id)}/${action}`, { method: "POST" })
  return fetchScenarioBuild(id)
}
