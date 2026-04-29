import { runSimulation, type RunStore } from "@simula/core"
import type { LLMSettings, RunManifest, ScenarioInput } from "@simula/shared"
import { appendAndPublish, type Subscriptions } from "./event-stream"
import { json } from "./responses"
import { RunCanceledError, type RoundContinuationStore } from "./round-continuation"
import { readSettings } from "./settings-store"

export async function startRun(
  store: RunStore,
  subscriptions: Subscriptions,
  runningRuns: Set<string>,
  roundContinuations: RoundContinuationStore,
  runId: string
): Promise<Response> {
  if (runningRuns.has(runId)) {
    return json({ status: "already_running" }, { status: 202 })
  }
  const manifest = await store.readManifest(runId)
  const scenario = await store.readScenario(runId)
  const settings = await readSettings()
  runningRuns.add(runId)
  roundContinuations.clearRun(runId)
  void executeRun(store, subscriptions, runningRuns, roundContinuations, manifest, scenario, settings)
  return json({ status: "started" }, { status: 202 })
}

export function continueRunRound(
  runningRuns: Set<string>,
  roundContinuations: RoundContinuationStore,
  runId: string,
  roundIndex: number
): Response {
  if (!runningRuns.has(runId)) {
    return json({ error: "Run is not active." }, { status: 409 })
  }
  roundContinuations.continue(runId, roundIndex)
  return json({ status: "continued" })
}

export function cancelRun(
  runningRuns: Set<string>,
  roundContinuations: RoundContinuationStore,
  runId: string
): Response {
  if (!runningRuns.has(runId)) {
    return json({ error: "Run is not active." }, { status: 409 })
  }
  roundContinuations.cancel(runId)
  return json({ status: "canceled" }, { status: 202 })
}

async function executeRun(
  store: RunStore,
  subscriptions: Subscriptions,
  runningRuns: Set<string>,
  roundContinuations: RoundContinuationStore,
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
      waitForNextRound: (roundIndex) => roundContinuations.wait(manifest.id, roundIndex),
      isCanceled: () => roundContinuations.isCanceled(manifest.id),
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
    if (error instanceof RunCanceledError || (error instanceof Error && error.message === "Run canceled.")) {
      await appendAndPublish(store, subscriptions, {
        type: "run.canceled",
        runId: manifest.id,
        timestamp: new Date().toISOString(),
      })
      await store.writeManifest({
        ...manifest,
        status: "canceled",
        startedAt,
        completedAt: new Date().toISOString(),
        stopReason: "canceled",
      })
      return
    }
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
    roundContinuations.clearRun(manifest.id)
  }
}
