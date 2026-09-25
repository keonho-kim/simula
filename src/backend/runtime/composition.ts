/**
 * Purpose: Construct one process-owned simulation runtime and release its temporary artifacts.
 * Pattern: Composition Root.
 * Usage: Created by server.ts once per Node.js process.
 * Related: src/backend/api/routes.ts, server.ts
 */
import { join } from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { DocumentJobs } from "@/backend/runtime/documents"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { ScenarioBuilderJobs } from "@/backend/runtime/scenario-builder/jobs"
import { WorldStore } from "@/backend/storage/worlds/world-store"
import { WorldPreparationJobs } from "@/backend/runtime/worlds/preparation"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { MultiverseJobs } from "@/backend/runtime/multiverse/jobs"
import { BatchStore } from "@/backend/storage/multiverse/batch-store"
import { AnalysisStore } from "@/backend/storage/analysis/report-store"
import { AnalysisJobs } from "@/backend/runtime/analysis/jobs"
import { readSettings, forgetSessionSettings } from "@/backend/storage/settings-store"
import { RunStore } from "@/backend/storage/runs/run-store"
import { Subscriptions } from "@/backend/runtime/events"
import { LIBREOFFICE_BIN, MODEL_QUEUE_LIMIT, MODEL_QUEUE_TIMEOUT_MS } from "@/backend/config"
import { RoundContinuationStore } from "@/backend/runtime/round-continuation"
import { BrowserSessions } from "@/backend/runtime/browser-sessions"
import { expireBrowserWork, removeOrphanActiveRoots } from "@/backend/runtime/expired-browser-work"
import type { RouteContext } from "@/backend/api/routes"

export async function createBackendRuntime(): Promise<{
  routes: RouteContext
  sessions: BrowserSessions
  close: () => Promise<void>
}> {
  await removeOrphanActiveRoots(tmpdir())
  const activeRoot = await mkdtemp(join(tmpdir(), `simula-active-${process.pid}-`))
  const store = new RunStore({ rootDir: activeRoot })
  const documentStore = new DocumentStore(join(activeRoot, "documents"))
  const initialSettings = await readSettings()
  const modelAdmission = new ModelAdmission({ concurrency: initialSettings.concurrency,
    maxQueued: MODEL_QUEUE_LIMIT, waitTimeoutMs: MODEL_QUEUE_TIMEOUT_MS })
  const documentJobs = new DocumentJobs(documentStore, LIBREOFFICE_BIN, readSettings, modelAdmission)
  const scenarioBuilderJobs = new ScenarioBuilderJobs(new ScenarioBuildStore(join(activeRoot, "scenario-builds")),
    documentStore, readSettings, modelAdmission)
  const worldJobs = new WorldPreparationJobs(new WorldStore(join(activeRoot, "worlds")), scenarioBuilderJobs.store,
    store, readSettings, modelAdmission)
  const subscriptions = new Subscriptions()
  const runningRuns = new Set<string>()
  const roundContinuations = new RoundContinuationStore()
  const multiverseJobs = new MultiverseJobs(new BatchStore(join(activeRoot, "multiverse")), {
    worlds: worldJobs, runs: store, subscriptions, runningRuns, continuations: roundContinuations,
    admission: modelAdmission, getSettings: readSettings,
  })
  const analysisJobs = new AnalysisJobs(new AnalysisStore(join(activeRoot, "analyses")), {
    runs: store, batches: multiverseJobs.store, scenarios: scenarioBuilderJobs.store, worlds: worldJobs.store,
    documents: documentStore,
  }, readSettings, modelAdmission)
  const sessions = new BrowserSessions(resource => expireBrowserWork(resource, {
    runs: store, runningRuns, continuations: roundContinuations, documents: documentStore, documentJobs,
    builds: scenarioBuilderJobs, worlds: worldJobs, batches: multiverseJobs, analyses: analysisJobs,
  }), Date.now, forgetSessionSettings)
  await store.ensureRoot()
  return {
    routes: { analysisJobs, multiverseJobs, modelAdmission, scenarioBuilderJobs, worldJobs, documentStore,
      documentJobs, store, subscriptions, runningRuns, roundContinuations },
    sessions,
    close: async () => { sessions.close(); await rm(activeRoot, { recursive: true, force: true }) },
  }
}
