/**
 * Purpose: Verify captured document revisions keep evidence and call history stable.
 * Pattern: Repository contract tests.
 * Usage: bun test src/backend/storage/documents/source-revisions.test.ts
 * Related: src/backend/storage/documents/document-store.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DocumentStore } from "./document-store"
import { extractTextEvidence } from "@/backend/core/documents/text"
import type { ModelMetrics } from "@/shared/run"

const bytes = (text: string) => new TextEncoder().encode(text)
const metrics: ModelMetrics = { role: "storyBuilder", step: "draft", attempt: 1, ttftMs: 4, durationMs: 12,
  inputTokens: 10, reasoningTokens: 0, outputTokens: 5, totalTokens: 15, tokenSource: "provider" }

test("captured source evidence and usage survive re-extraction and reopening", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-source-revision-"))
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const file = await store.addFile(set.id, "budget.txt", bytes("Budget 120"))
    const original = extractTextEvidence(file.id, bytes("Budget 120"))
    await store.appendMetrics(set.id, file.id, 1, metrics)
    await store.saveExtraction(set.id, file.id, original)
    const revision = (await store.readSet(set.id)).revision
    const captured = await store.captureRevision(set.id, revision)
    await store.updateStatus(set.id, file.id, "processing")
    await store.appendMetrics(set.id, file.id, 1, metrics)
    await store.saveExtraction(set.id, file.id, extractTextEvidence(file.id, bytes("Budget 999")))
    await store.addFile(set.id, "new.txt", bytes("Unrelated newer file"))
    const reopened = new DocumentStore(root)
    expect(await reopened.readSet(set.id, revision)).toEqual(captured)
    expect(await reopened.readExtraction(set.id, file.id, revision)).toEqual(original)
    expect((await reopened.readExtraction(set.id, file.id)).blocks[0]?.content).toContain("999")
    expect((await reopened.readCallRecords(set.id, file.id, revision))?.metrics).toHaveLength(1)
    expect((await reopened.readCallRecords(set.id, file.id))?.metrics).toHaveLength(2)
    expect(await reopened.captureRevision(set.id, revision)).toEqual(captured)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("capture rejects unready or uncaptured obsolete sources and never substitutes latest evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-source-unavailable-"))
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const file = await store.addFile(set.id, "source.txt", bytes("Source"))
    const unready = (await store.readSet(set.id)).revision
    await expect(store.captureRevision(set.id, unready)).rejects.toThrow("Extract")
    await store.saveExtraction(set.id, file.id, extractTextEvidence(file.id, bytes("Source")))
    await expect(store.captureRevision(set.id, unready)).rejects.toThrow("changed")
    await expect(store.readExtraction(set.id, file.id, unready)).rejects.toThrow("revision")
    await expect(store.readSet(set.id, -1)).rejects.toThrow("revision")
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("concurrent captures are idempotent and a snapshot cannot expose a later document", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-source-scope-"))
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const file = await store.addFile(set.id, "source.txt", bytes("Source"))
    await store.saveExtraction(set.id, file.id, extractTextEvidence(file.id, bytes("Source")))
    const revision = (await store.readSet(set.id)).revision
    const captures = await Promise.all([store.captureRevision(set.id, revision), store.captureRevision(set.id, revision)])
    expect(captures[0]).toEqual(captures[1])
    const later = await store.addFile(set.id, "later.txt", bytes("Later"))
    await store.saveExtraction(set.id, later.id, extractTextEvidence(later.id, bytes("Later")))
    await expect(store.readExtraction(set.id, later.id, revision)).rejects.toThrow("not found")
  } finally { await rm(root, { recursive: true, force: true }) }
})
