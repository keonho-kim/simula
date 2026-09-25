/**
 * Purpose: Verify document artifact ownership, concurrent uploads, and source persistence.
 * Pattern: Repository integration test.
 * Usage: Executed by bun test with temporary directories.
 * Related: src/backend/storage/documents/document-store.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DocumentStore } from "./document-store"
import { extractTextEvidence } from "@/backend/core/documents/text"
import type { ModelMetrics } from "@/shared/run"

test("concurrent uploads preserve both files and validated extraction survives reopening", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-documents-"))
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const uploads = await Promise.all(["기획.txt", "실적.md"].map(name => store.addFile(set.id, name, new TextEncoder().encode("근거 자료"))))
    expect((await store.readSet(set.id)).documents).toHaveLength(2)
    const file = uploads[0]!
    const evidence = extractTextEvidence(file.id, await store.readOriginal(set.id, file.id))
    await store.saveExtraction(set.id, file.id, evidence)
    const reopened = new DocumentStore(root)
    expect(await reopened.readExtraction(set.id, file.id)).toEqual(evidence)
    expect((await reopened.readSet(set.id)).documents.find(doc => doc.id === file.id)?.status).toBe("ready")
    await expect(reopened.readSet("../outside")).rejects.toThrow("identifier")
    const other = await store.createSet()
    await expect(store.readOriginal(other.id, file.id)).rejects.toThrow("not found")
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("a page vision failure is visible on the document status", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-document-conflict-"))
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const file = await store.addFile(set.id, "example.pdf", new TextEncoder().encode("%PDF-1.4"))
    const evidence = extractTextEvidence(file.id, new TextEncoder().encode("Costs 0"))
    await store.saveExtraction(set.id, file.id, { blocks: evidence.blocks, coverage: {
      unit: "regions", totalUnits: 2, processedUnits: 1, skippedUnits: 0, failedUnits: 1,
    }, issues: [{ code: "page_vision_failed", message: "The page image could not be read." }] })
    expect(await store.readDocument(set.id, file.id)).toMatchObject({ status: "partial", issue: { code: "page_vision_failed" } })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("page-scoped model calls and failed admissions survive reopening without inventing usage", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-document-metrics-"))
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const file = await store.addFile(set.id, "source.pdf", new TextEncoder().encode("%PDF-1.4"))
    expect(await store.readCallRecords(set.id, file.id)).toEqual({ metrics: [], failures: [] })
    const metrics: ModelMetrics = { role: "storyBuilder", step: "draft", attempt: 1,
      ttftMs: 4, durationMs: 12, queueWaitMs: 2, inputTokens: 10, reasoningTokens: 0,
      outputTokens: 5, totalTokens: 15, tokenSource: "provider" }
    await Promise.all([store.appendMetrics(set.id, file.id, 1, metrics), store.appendMetrics(set.id, file.id, 2, metrics)])
    await store.appendFailure(set.id, file.id, { role: "storyBuilder", step: "draft", attempt: 1,
      taskId: `${file.id}:page:3`, outcome: "failed", queueWaitMs: 1 })
    const reopened = new DocumentStore(root)
    const calls = await reopened.readCallRecords(set.id, file.id)
    expect(calls?.metrics.map(call => call.page).sort()).toEqual([1, 2])
    expect(calls?.failures).toMatchObject([{ failure: { taskId: `${file.id}:page:3`, outcome: "failed" } }])
    await unlink(join(root, set.id, file.id, "metrics.jsonl"))
    expect(await reopened.readCallRecords(set.id, file.id)).toBeUndefined()
  } finally { await rm(root, { recursive: true, force: true }) }
})
