/**
 * Purpose: Verify every accepted analytical artifact rejects a displaced execution owner.
 * Pattern: Repository fencing contract test.
 * Usage: bun test src/backend/storage/analysis/ownership.test.ts
 * Related: src/backend/storage/analysis/report-store.ts, src/backend/storage/generation/execution-lease.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AnalysisStore } from "./report-store"
import { ExecutionOwnership } from "../generation/execution-lease"

test("report manifests, citations and task files all require the current owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-report-artifact-fence-"))
  try {
    const store = new AnalysisStore(root)
    const record = await store.create({ id: crypto.randomUUID(), subject: { kind: "run", id: "test-run" },
      createdAt: new Date().toISOString(), deadlineAt: new Date(Date.now() + 60_000).toISOString(),
      inputRevision: "source-one", language: "en", fastMode: false, maxCalls: 100, status: "running" })
    const old = store.execution(record.id).claim()
    if (!old) throw new Error("Missing original owner")
    const reference = { id: "one-source", category: "source_claim" as const, text: "Original source." }
    await store.saveReference(record.id, reference, old)
    const directory = join(root, record.id)
    const current = new ExecutionOwnership(directory, () => old.expiresAt + 1).claim()
    if (!current) throw new Error("Missing replacement owner")
    const accepted = { ...reference, text: "Replacement source." }
    await store.saveReference(record.id, accepted, current)
    await store.saveTask(record.id, { id: "one-task", fingerprint: "current", attempt: 1, value: "Replacement" }, current)
    await store.write({ ...record, status: "failed", stopReason: "call_budget" }, current)
    await expect(store.saveReference(record.id, { ...reference, text: "Late overwrite" }, old)).rejects.toThrow("ownership")
    await expect(store.saveTask(record.id, { id: "one-task", fingerprint: "old", attempt: 1, value: "Late overwrite" }, old)).rejects.toThrow("ownership")
    await expect(store.write({ ...record, status: "running" }, old)).rejects.toThrow("ownership")
    expect(await store.readReference(record.id, reference.id)).toEqual(accepted)
    expect((await store.readTask(record.id, "one-task"))?.value).toBe("Replacement")
    expect(await store.read(record.id)).toMatchObject({ status: "failed", stopReason: "call_budget" })
    expect((await readdir(directory)).filter(file => file.endsWith(".tmp"))).toEqual([])
    old.release(); current.release()
  } finally { await rm(root, { recursive: true, force: true }) }
})
