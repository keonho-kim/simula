/**
 * Purpose: Verify durable subject discovery without changing report identity or creation order.
 * Pattern: Repository contract tests using temporary artifacts.
 * Usage: bun test src/backend/storage/analysis/report-store.test.ts
 * Related: src/backend/storage/analysis/report-store.ts, src/shared/analytical-report.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { AnalysisRecord, AnalysisSubject } from "@/shared/analytical-report"
import { AnalysisStore } from "./report-store"

function record(subject: AnalysisSubject, createdAt: string): AnalysisRecord {
  return { id: crypto.randomUUID(), subject, createdAt, deadlineAt: "2026-09-23T15:00:00.000Z", inputRevision: "source-one",
    language: "en", fastMode: true, maxCalls: 100, status: "failed" }
}

test("latest report is scoped, durable, and not demoted by concurrent or repeated older creations", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-report-index-"))
  const store = new AnalysisStore(root)
  const subject: AnalysisSubject = { kind: "run", id: "run-one" }
  try {
    expect(await store.latest(subject)).toBeUndefined()
    const older = record(subject, "2026-09-23T12:00:00.000Z")
    const newer = record(subject, "2026-09-23T12:01:00.000Z")
    await Promise.all([store.create(newer), store.create(older)])
    await store.create({ ...older, createdAt: "2026-09-23T13:00:00.000Z" })
    expect((await store.latest(subject))?.id).toBe(newer.id)
    expect((await new AnalysisStore(root).latest(subject))?.id).toBe(newer.id)
    expect(await store.latest({ kind: "run", id: "another-run" })).toBeUndefined()
    const batch = record({ kind: "batch", id: crypto.randomUUID() }, "2026-09-23T14:00:00.000Z")
    await store.create(batch)
    expect((await store.latest(subject))?.id).toBe(newer.id)
    expect((await store.latest(batch.subject))?.id).toBe(batch.id)
    expect((await store.read(older.id)).createdAt).toBe(older.createdAt)
  } finally { await rm(root, { recursive: true, force: true }) }
})
