import { runSimulation, type RunStore } from "@simula/core"
import type { LLMSettings, RunManifest, ScenarioInput } from "@simula/shared"
import { appendAndPublish, type Subscriptions } from "./event-stream"
import { json } from "./responses"
import { readSettings } from "./settings-store"

export async function startRun(
  store: RunStore,
  subscriptions: Subscriptions,
  runningRuns: Set<string>,
  runId: string
): Promise<Response> {
  if (runningRuns.has(runId)) {
    return json({ status: "already_running" }, { status: 202 })
  }
  const manifest = await store.readManifest(runId)
  const scenario = await store.readScenario(runId)
  const settings = await readSettings()
  runningRuns.add(runId)
  void executeRun(store, subscriptions, runningRuns, manifest, scenario, settings)
  return json({ status: "started" }, { status: 202 })
}

async function executeRun(
  store: RunStore,
  subscriptions: Subscriptions,
  runningRuns: Set<string>,
  manifest: RunManifest,
  scenario: ScenarioInput,
  settings: LLMSettings
): Promise<void> {
  const startedAt = new Date().toISOString()
  await store.writeManifest({ ...manifest, status: "running", startedAt })
  try {
    const finalState = await runSimulation({
      runId: manifest.id,
      scenario,
      settings,
      roundDelayMs: 5000,
      emit: (event) => appendAndPublish(store, subscriptions, event),
    })
    await store.writeState(finalState)
    await store.writeManifest({
      ...manifest,
      status: "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      stopReason: finalState.stopReason,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Run failed."
    await appendAndPublish(store, subscriptions, {
      type: "run.failed",
      runId: manifest.id,
      timestamp: new Date().toISOString(),
      error: message,
    })
    await store.writeManifest({
      ...manifest,
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      stopReason: "failed",
      error: message,
    })
  } finally {
    runningRuns.delete(manifest.id)
  }
}

