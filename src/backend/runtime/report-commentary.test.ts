/**
 * Purpose: Verify report interruption recovery and shared API execution ownership.
 * Pattern: Runtime integration test.
 * Usage: Executed by bun test.
 * Related: src/backend/runtime/report-commentary.ts, src/backend/api/routes.ts
 */
import { seedRunManifest, seedRunState } from "@/backend/storage/runs/testing/fixtures"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { MultiverseJobs } from "./multiverse/jobs"
import { BatchStore } from "@/backend/storage/multiverse/batch-store"
import { AnalysisJobs } from "./analysis/jobs"
import { AnalysisStore } from "@/backend/storage/analysis/report-store"
import { expect, spyOn, test } from "bun:test"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { DocumentJobs } from "./documents"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { ScenarioBuilderJobs } from "./scenario-builder/jobs"
import { WorldStore } from "@/backend/storage/worlds/world-store"
import { WorldPreparationJobs } from "./worlds/preparation"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RunStore } from "@/backend/storage/runs/run-store"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { parseScenarioDocument } from "@/backend/core/scenario"
import { defaultSettings } from "@/backend/core/settings/defaults"
import * as invocation from "@/backend/integrations/llm/invoke"
import { Subscriptions } from "./events"
import { RoundContinuationStore } from "./round-continuation"
import { executeReportCommentary } from "./report-commentary"
import { route } from "@/backend/api/routes"

test("commentary interruption preserves results and releases the lock; stale running state is retryable", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-commentary-"))
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockRejectedValue(new Error("offline"))
  try {
    const store = new RunStore({ rootDir: root })
    const scenario = parseScenarioDocument("---\nnum_cast: 2\n---\nTest")
    const run = await store.createRun(scenario)
    const state = initialSimulationState(run.id, scenario)
    state.roundReports = [{ roundIndex: 1, title: "Review", roundSummary: "Discussed the decision" }]
    await seedRunManifest(store, { ...run, status: "completed" })
    const runningRuns = new Set([run.id])
    const subscriptions = new Subscriptions()
    const roundContinuations = new RoundContinuationStore()
    const modelAdmission = new ModelAdmission({ concurrency: 8 })
    const documentStore = new DocumentStore(join(root, "documents"))
    const documentJobs = new DocumentJobs(documentStore, "soffice", async () => defaultSettings(), modelAdmission)
    const scenarioBuilderJobs = new ScenarioBuilderJobs(new ScenarioBuildStore(join(root, "scenario-builds")), documentStore, async () => defaultSettings(), modelAdmission)
    const worldJobs = new WorldPreparationJobs(new WorldStore(join(root, "worlds")), scenarioBuilderJobs.store, store, async () => defaultSettings(), modelAdmission)
    const multiverseJobs = new MultiverseJobs(new BatchStore(join(root, "batches")), { worlds: worldJobs, runs: store, subscriptions,
      runningRuns, continuations: roundContinuations, admission: modelAdmission, getSettings: async () => defaultSettings() })
    const analysisJobs = new AnalysisJobs(new AnalysisStore(join(root, "analyses")), { runs: store, batches: multiverseJobs.store,
      scenarios: scenarioBuilderJobs.store, worlds: worldJobs.store, documents: documentStore }, async () => defaultSettings(), modelAdmission)
    const context = { analysisJobs, modelAdmission, multiverseJobs, store, subscriptions, runningRuns, roundContinuations, documentStore, documentJobs, scenarioBuilderJobs, worldJobs }
    await executeReportCommentary(store, subscriptions, runningRuns, roundContinuations, state, defaultSettings(), modelAdmission)
    const saved = await store.readState(run.id)
    expect(saved?.reportCommentary?.status).toBe("failed")
    expect(saved?.roundReports).toEqual(state.roundReports)
    expect(runningRuns.size).toBe(0)
    expect((await store.readManifest(run.id)).status).toBe("completed")
    await seedRunState(store, { ...state, reportCommentary: { status: "running", nodes: [] } })
    const url = new URL(`http://localhost/api/runs/${run.id}`)
    const response = await route(context, new Request(url), url)
    const body = await response.json()
    expect(body.state.reportCommentary.status).toBe("partial")
    runningRuns.add(run.id)
    const post = new URL(`${url}/commentary`)
    expect((await route(context, new Request(post, { method: "POST" }), post)).status).toBe(409)
  } finally { spy.mockRestore(); await rm(root, { recursive: true, force: true }) }
})
