/**
 * Purpose: Verify the upload-to-evidence HTTP workflow and file-scoped extraction failures.
 * Pattern: API integration test.
 * Usage: Executed by bun test using temporary local artifacts.
 * Related: src/backend/api/documents/document-controller.ts, src/backend/runtime/documents.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { DocumentJobs } from "@/backend/runtime/documents"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { extractCsvEvidence } from "@/backend/core/documents/csv"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { routeDocuments } from "./document-controller"

test("uploads Korean documents and exposes accepted evidence through the API", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-document-api-"))
  try {
    const store = new DocumentStore(root)
    const jobs = new DocumentJobs(store, "missing-simula-office", async () => defaultSettings(), new ModelAdmission({ concurrency: 8 }))
    const create = new Request("http://local/api/documents", { method: "POST" })
    const response = await routeDocuments(store, jobs, create, new URL(create.url))
    expect(response.status).toBe(201)
    const set = (await response.json()).documentSet
    const form = new FormData()
    form.set("file", new File(["# 투자 회의\n예산은 2억 원입니다."], "투자.md"))
    const upload = new Request(`http://local/api/documents/${set.id}/files`, { method: "POST", body: form })
    const uploaded = await routeDocuments(store, jobs, upload, new URL(upload.url))
    expect(uploaded.status).toBe(201)
    const document = (await uploaded.json()).document
    const first = jobs.start(set.id, document.id)
    expect(jobs.start(set.id, document.id).alreadyRunning).toBe(true)
    await first.completion
    const evidence = new Request(`${upload.url}/${document.id}/evidence`)
    const result = await routeDocuments(store, jobs, evidence, new URL(evidence.url))
    expect(result.status).toBe(200)
    const body = await result.json()
    expect(body.blocks[0].content).toContain("2억 원")
    expect(body.blocks[0].locator).toMatchObject({ kind: "text", startLine: 1 })
    expect(body.nextOffset).toBeNull()
    const csv = await store.addFile(set.id, "risks.csv", new TextEncoder().encode("Risk,Owner\n인증 지연,CTO"))
    await jobs.start(set.id, csv.id).completion
    const csvEvidence = await store.readExtraction(set.id, csv.id)
    expect(csvEvidence.blocks.some(block => block.content.includes("Owner: CTO")
      && block.locator.kind === "table" && block.locator.startRow === 2)).toBe(true)
    const binary = await store.addFile(set.id, "legacy.docx", new TextEncoder().encode("not an Office file"))
    await jobs.start(set.id, binary.id).completion
    expect(await store.readDocument(set.id, binary.id)).toMatchObject({ status: "failed", issue: { code: "converter_unavailable" } })
    expect((await store.readDocument(set.id, document.id)).status).toBe("ready")
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("rejects oversized declared uploads before allocating a form body", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-document-limit-"))
  try {
    const store = new DocumentStore(root)
    const jobs = new DocumentJobs(store, "soffice", async () => defaultSettings(), new ModelAdmission({ concurrency: 8 }))
    const set = await store.createSet()
    const request = new Request(`http://local/api/documents/${set.id}/files`, {
      method: "POST", body: "small", headers: { "content-type": "multipart/form-data; boundary=test", "content-length": "999999999" },
    })
    expect((await routeDocuments(store, jobs, request, new URL(request.url))).status).toBe(413)
    expect((await store.readSet(set.id)).documents).toHaveLength(0)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("an exact source ID returns only its owning document block", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-document-exact-evidence-"))
  try {
    const store = new DocumentStore(root)
    const jobs = new DocumentJobs(store, "soffice", async () => defaultSettings(), new ModelAdmission({ concurrency: 1 }))
    const set = await store.createSet()
    const file = await store.addFile(set.id, "budget.csv", new TextEncoder().encode("Name,Value\nBudget,120"))
    const other = await store.addFile(set.id, "other.csv", new TextEncoder().encode("Name,Value\nSecret,10"))
    const extraction = extractCsvEvidence(file.id, await store.readOriginal(set.id, file.id))
    await store.saveExtraction(set.id, file.id, extraction)
    await store.saveExtraction(set.id, other.id, extractCsvEvidence(other.id, await store.readOriginal(set.id, other.id)))
    const revision = (await store.readSet(set.id)).revision
    await store.captureRevision(set.id, revision)
    const id = extraction.blocks.find(block => block.content.includes("Budget"))?.id
    if (!id) throw new Error("Missing source fixture")
    const read = async (documentId: string) => {
      const request = new Request(`http://local/api/documents/${set.id}/files/${documentId}/evidence?id=${encodeURIComponent(id)}&revision=${revision}`)
      return routeDocuments(store, jobs, request, new URL(request.url))
    }
    const response = await read(file.id)
    expect(response.status).toBe(200)
    expect((await response.json()).block).toMatchObject({ id, documentId: file.id })
    expect((await read(other.id)).status).toBe(404)
    const missingRevision = new Request(`http://local/api/documents/${set.id}/files/${file.id}/evidence?id=${encodeURIComponent(id)}`)
    expect((await routeDocuments(store, jobs, missingRevision, new URL(missingRevision.url))).status).toBe(400)
    await store.addFile(set.id, "later.txt", new TextEncoder().encode("Later source"))
    expect((await read(file.id)).status).toBe(200)
  } finally { await rm(root, { recursive: true, force: true }) }
})
