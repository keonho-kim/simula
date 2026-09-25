/**
 * Purpose: Build isolated batch runtime fixtures with deterministic model behavior.
 * Pattern: Integration test fixture.
 * Usage: Imported by Multiverse runtime and API tests.
 * Related: src/backend/runtime/multiverse/jobs.test.ts, src/backend/core/story-builder/world/test-fixtures.ts
 */
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { specification, dependencies } from "@/backend/core/story-builder/world/test-fixtures"
import { parseBuilderRequest } from "@/backend/core/scenario-builder/contracts"
import type { GenerationCall } from "@/backend/core/generation/tasks"
import { RunStore } from "@/backend/storage/runs/run-store"
import { WorldStore } from "@/backend/storage/worlds/world-store"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { BatchStore } from "@/backend/storage/multiverse/batch-store"
import { WorldPreparationJobs } from "../worlds/preparation"
import { ModelAdmission } from "../model-admission"
import { Subscriptions } from "../events"
import { RoundContinuationStore } from "../round-continuation"
import { MultiverseJobs } from "./jobs"

export async function batchFixture(beforeCall?: (call: GenerationCall, signal: AbortSignal) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "simula-multiverse-"))
  const previous = process.env.SIMULA_TEST_MODEL
  process.env.SIMULA_TEST_MODEL = "1"
  const settings = defaultSettings()
  settings.providers.openai.apiKey = "unit-test-api-key"
  const scenarios = new ScenarioBuildStore(join(root, "scenarios"))
  const record = await scenarios.create(specification.id, parseBuilderRequest({ documentSetId: specification.documentSetId, documentRevision: specification.documentRevision }))
  const lease = scenarios.execution(record.id).claim()
    if (!lease) throw new Error("Cannot prepare the test scenario")
    try { await scenarios.write({ ...record, status: "confirmed", specification }, lease) }
    finally { lease.release() }
  const admission = new ModelAdmission({ concurrency: 50 })
  const runs = new RunStore({ rootDir: join(root, "runs") })
  const f = dependencies()
  const worlds = new WorldPreparationJobs(new WorldStore(join(root, "worlds")), scenarios, runs, async () => settings, admission,
    (_settings, signal) => async call => { await beforeCall?.(call, signal); signal.throwIfAborted(); return f.deps.invoke(call) })
  const store = new BatchStore(join(root, "batches"))
  const runningRuns = new Set<string>()
  const runtime = { worlds, runs, runningRuns, admission, subscriptions: new Subscriptions(),
    continuations: new RoundContinuationStore(), getSettings: async () => settings }
  const jobs = new MultiverseJobs(store, runtime)
  return { jobs, runtime, runs, worlds, scenarios, runningRuns, admission, calls: f.calls, source: specification,
    close: async () => { if (previous === undefined) delete process.env.SIMULA_TEST_MODEL; else process.env.SIMULA_TEST_MODEL = previous; await rm(root, { recursive: true, force: true }) } }
}
