import { runSimulation } from "@/backend/core/simulation/workflow/graph"
import type { RunStore } from "@/backend/storage/runs/run-store"
import type { LLMSettings, RunManifest, ScenarioInput } from "@/shared"
import { appendAndPublish, type Subscriptions } from "@/backend/runtime/events"
import { RunCanceledError, type RoundContinuationStore } from "@/backend/runtime/round-continuation"

export async function executeRun(
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
