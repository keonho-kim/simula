/**
 * Purpose: Verify analytical execution preserves ownership across runtime instances and late completions.
 * Pattern: Runtime concurrency integration tests.
 * Usage: bun test src/backend/runtime/analysis/ownership.test.ts
 * Related: src/backend/runtime/analysis/jobs.ts, src/backend/storage/generation/execution-lease.ts
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
import { ExecutionOwnership } from "@/backend/storage/generation/execution-lease"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { testAnalyticalReportResponse } from "@/backend/integrations/llm/testing/analysis-response"

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "simula-report-owner-"))
  const store = new AnalysisStore(join(root, "reports"))
  const runs = new RunStore({ rootDir: join(root, "runs") })
  const sources = { runs, batches: new BatchStore(join(root, "batches")), scenarios: new ScenarioBuildStore(join(root, "scenarios")),
    worlds: new WorldStore(join(root, "worlds")), documents: new DocumentStore(join(root, "documents")) }
  const settings = defaultSettings(); settings.providers.openai.apiKey = "unit-test-api-key"
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  let calls = 0
  const createJobs = () => new AnalysisJobs(new AnalysisStore(store.rootDir), sources, async () => settings,
    new ModelAdmission({ concurrency: 1 }), () => async call => {
      calls++; entered.resolve(); await release.promise
      const text = testAnalyticalReportResponse(call.prompt)
      if (!text) throw new Error("Unknown test generation contract")
      return { text, truncated: false }
    })
  const run = await runs.createRun({ text: "Review investment evidence.", controls: { numCast: 2, maxRound: 1, actionsPerType: 1, fastMode: false, allowAdditionalCast: false } })
  await seedRunManifest(runs, { ...run, status: "completed", completedAt: new Date().toISOString() })
  const record = await createJobs().create(crypto.randomUUID(), { kind: "run", id: run.id })
  return { root, store, record, entered, release, createJobs, calls: () => calls,
    close: () => rm(root, { recursive: true, force: true }) }
}

test("another runtime observes a running report, avoids duplicate calls and cancels the owner", async () => {
  const f = await fixture()
  let work: Promise<void> | undefined
  try {
    const first = f.createJobs(), second = f.createJobs()
    work = first.start(f.record.id)
    await f.entered.promise
    expect((await second.read(f.record.id)).status).toBe("running")
    await second.start(f.record.id)
    expect(f.calls()).toBe(1)
    expect(second.cancel(f.record.id)).toBe(true)
    f.release.resolve(); await work
    expect(await second.read(f.record.id)).toMatchObject({ status: "canceled", stopReason: "user" })
  } finally { f.release.resolve(); await work; await f.close() }
})

test("immediate report cancellation persists without a model call", async () => {
  const f = await fixture()
  let work: Promise<void> | undefined
  try {
    const jobs = f.createJobs()
    work = jobs.start(f.record.id)
    expect(jobs.cancel(f.record.id)).toBe(true)
    await work
    expect(await jobs.read(f.record.id)).toMatchObject({ status: "canceled", stopReason: "user" })
    expect(f.calls()).toBe(0)
  } finally { f.release.resolve(); await work?.catch(() => undefined); await f.close() }
})

test("a displaced report worker cannot replace its successor's terminal manifest", async () => {
  const f = await fixture()
  let work: Promise<void> | undefined
  try {
    work = f.createJobs().start(f.record.id)
    await f.entered.promise
    const replacement = new ExecutionOwnership(join(f.store.rootDir, f.record.id), () => Date.now() + 60_000).claim()
    if (!replacement) throw new Error("Missing replacement claim")
    await f.store.write({ ...f.record, status: "failed", stopReason: "call_budget" }, replacement)
    f.release.resolve(); await work
    expect(await f.store.read(f.record.id)).toMatchObject({ status: "failed", stopReason: "call_budget" })
    expect(f.store.execution(f.record.id).isActive()).toBe(true)
    replacement.release()
  } finally { f.release.resolve(); await work; await f.close() }
})
