/**
 * Purpose: Ensure retrying a partial report never removes previously accepted prose from readers.
 * Pattern: Runtime recovery test with a controlled failing provider.
 * Usage: bun test src/backend/runtime/analysis/recovery.test.ts
 * Related: src/backend/runtime/analysis/jobs.ts, src/backend/storage/analysis/report-store.ts
 */
import { seedRunManifest } from "@/backend/storage/runs/testing/fixtures"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AnalysisJobs } from "./jobs"
import { ModelAdmission } from "../model-admission"
import { AnalysisStore } from "@/backend/storage/analysis/report-store"
import { RunStore } from "@/backend/storage/runs/run-store"
import { BatchStore } from "@/backend/storage/multiverse/batch-store"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { WorldStore } from "@/backend/storage/worlds/world-store"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { analysisFixture } from "@/backend/core/simulation/outputs/analysis/test-fixtures"
import { generateAnalyticalReport } from "@/backend/core/simulation/outputs/analysis/graph"

test("prior accepted sections stay readable during and after a failed retry", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-analysis-recovery-"))
  const store = new AnalysisStore(join(root, "reports"))
  const runs = new RunStore({ rootDir: join(root, "runs") })
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const settings = defaultSettings()
  settings.providers.openai.apiKey = "unit-test-api-key"
  const jobs = new AnalysisJobs(store, { runs, batches: new BatchStore(join(root, "batches")), scenarios: new ScenarioBuildStore(join(root, "scenarios")),
    worlds: new WorldStore(join(root, "worlds")), documents: new DocumentStore(join(root, "documents")) },
    async () => settings, new ModelAdmission({ concurrency: 1 }), () => async () => { entered.resolve(); await release.promise; throw new Error("provider unavailable") })
  let work: Promise<void> | undefined
  try {
    const scenario = { text: "Review investment evidence.", controls: { numCast: 2, maxRound: 1, actionsPerType: 1, fastMode: false, allowAdditionalCast: false } }
    const run = await runs.createRun(scenario)
    await seedRunManifest(runs, { ...run, status: "completed", completedAt: new Date().toISOString() })
    const record = await jobs.create(crypto.randomUUID(), { kind: "run", id: run.id })
    const fixture = analysisFixture()
    const report = await generateAnalyticalReport(record.id, fixture.input, fixture.dependencies)
    report.sections[0] = { id: "strengths", status: "failed", content: "", summary: "", findings: [], evidenceIds: [] }
    const seedLease = store.execution(record.id).claim()
    if (!seedLease) throw new Error("Missing fixture ownership")
    try { await store.write({ ...record, status: "partial", report }, seedLease) }
    finally { seedLease.release() }
    work = jobs.start(record.id)
    await Promise.race([entered.promise, work.then(() => { throw new Error("Generation stopped before invoking the controlled provider") })])
    expect((await jobs.read(record.id)).report).toEqual(report)
    release.resolve()
    await work
    const failed = await jobs.read(record.id)
    expect(failed.status).toBe("failed")
    expect(failed.report).toEqual(report)
  } finally { release.resolve(); await work; await rm(root, { recursive: true, force: true }) }
})
