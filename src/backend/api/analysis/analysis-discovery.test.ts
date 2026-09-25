/**
 * Purpose: Verify report discovery distinguishes outdated sources without invoking a model or erasing results.
 * Pattern: API lifecycle contract test with persisted source revisions.
 * Usage: bun test src/backend/api/analysis/analysis-discovery.test.ts
 * Related: src/backend/api/analysis/analysis-controller.ts, src/backend/runtime/analysis/jobs.ts
 */
import { seedRunManifest } from "@/backend/storage/runs/testing/fixtures"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { AnalysisJobs } from "@/backend/runtime/analysis/jobs"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { RunStore } from "@/backend/storage/runs/run-store"
import { AnalysisStore } from "@/backend/storage/analysis/report-store"
import { BatchStore } from "@/backend/storage/multiverse/batch-store"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { WorldStore } from "@/backend/storage/worlds/world-store"
import { routeAnalysis } from "./analysis-controller"

test("GET discovers reports and marks changed or unavailable inputs without loading provider settings", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-analysis-discovery-"))
  const runs = new RunStore({ rootDir: join(root, "runs") })
  const reports = new AnalysisStore(join(root, "reports"))
  let settingsReads = 0
  const jobs = new AnalysisJobs(reports, { runs, batches: new BatchStore(join(root, "batches")), scenarios: new ScenarioBuildStore(join(root, "scenarios")),
    worlds: new WorldStore(join(root, "worlds")), documents: new DocumentStore(join(root, "documents")) },
    async () => { settingsReads++; throw new Error("Read operations must not resolve model settings") }, new ModelAdmission({ concurrency: 1 }))
  const get = (path: string) => { const request = new Request(`http://localhost${path}`); return routeAnalysis(jobs, request, new URL(request.url)) }
  try {
    const run = await runs.createRun({ text: "Finance and engineering review the investment.", language: "en", controls: { numCast: 2, maxRound: 1, actionsPerType: 1, allowAdditionalCast: false, fastMode: true } })
    const path = `/api/analysis?kind=run&subject=${encodeURIComponent(run.id)}`
    expect(await (await get(path)).json()).toEqual({ analysis: null, freshness: null })
    await seedRunManifest(runs, { ...run, status: "completed", completedAt: "2026-09-23T12:00:00.000Z" })
    const created = await jobs.create(crypto.randomUUID(), { kind: "run", id: run.id })
    const seedLease = reports.execution(created.id).claim()
    if (!seedLease) throw new Error("Missing fixture ownership")
    try { await reports.write({ ...created, status: "failed" }, seedLease) }
    finally { seedLease.release() }
    expect(await (await get(path)).json()).toMatchObject({ analysis: { id: created.id, status: "failed" }, freshness: "current" })
    await seedRunManifest(runs, { ...run, status: "completed", completedAt: "2026-09-23T13:00:00.000Z" })
    expect(await (await get(path)).json()).toMatchObject({ analysis: { id: created.id }, freshness: "outdated" })
    await rm(join(root, "runs", run.id), { recursive: true })
    expect(await (await get(path)).json()).toMatchObject({ analysis: { id: created.id }, freshness: "unavailable" })
    expect((await get("/api/analysis?kind=batch&subject=not-a-uuid")).status).toBe(400)
    expect((await get("/api/analysis?kind=run&subject=../escape")).status).toBe(400)
    expect((await reports.read(created.id)).inputRevision).toBe(created.inputRevision)
    expect(settingsReads).toBe(0)
  } finally { await rm(root, { recursive: true, force: true }) }
})
