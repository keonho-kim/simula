/**
 * Purpose: Execute and persist a simulation under durable run ownership and cancellation.
 * Pattern: Execution lifecycle coordinator.
 * Usage: Dispatched by standalone and batch controllers with a local active-run marker.
 * Related: src/backend/runtime/run-ownership.ts, src/backend/storage/runs/run-store.ts
 */
import { runWithModelExecution, type ModelCallAdmission } from "@/backend/integrations/llm/execution-context"
import { runSimulation } from "@/backend/core/simulation/workflow/graph"
import type { RunStore } from "@/backend/storage/runs/run-store"
import type { LLMSettings, RunEvent, RunManifest, ScenarioInput } from "@/shared"
import { appendAndPublish, type Subscriptions } from "./events"
import type { RoundContinuationStore } from "./round-continuation"
import { runWithRunOwnership } from "./run-ownership"
import { publishGenerationFailure, type ExecutionParent } from "./generation/ownership"

export interface RunExecutionOptions {
  parent?: ExecutionParent
  waitForNextRound?: (roundIndex: number) => Promise<void>
  onEvent?: (event: RunEvent) => Promise<void>
  commentary?: "generate" | "defer"
}

export async function executeRun(
  store: RunStore, subscriptions: Subscriptions, runningRuns: Set<string>, roundContinuations: RoundContinuationStore,
  manifest: RunManifest, scenario: ScenarioInput, settings: LLMSettings, admission: ModelCallAdmission,
  options: RunExecutionOptions = {}
): Promise<void> {
  await runWithRunOwnership(store, manifest.id, runningRuns, roundContinuations, async (lease, ownerSignal) => {
    const signal = options.parent ? AbortSignal.any([ownerSignal, options.parent.signal]) : ownerSignal
    // Another execution may have finished after the controller read this manifest.
    const current = await store.readManifest(manifest.id)
    if (current.status !== "created") return
    const startedAt = new Date().toISOString()
    const approvals = store.roundApprovals(manifest.id)
    const emit = (event: RunEvent) => {
      if (event.type !== "run.canceled" && event.type !== "model.metrics" && event.type !== "model.attempt.failed" && event.type !== "log") options.parent?.assertActive()
      if (!options.waitForNextRound && event.type === "round.completed" && event.awaitsContinuation) {
        approvals.open(event.roundIndex, lease)
      }
      return appendAndPublish(store, subscriptions, event, lease)
    }
    try {
      signal.throwIfAborted()
      options.parent?.assertActive()
      await store.writeManifest({ ...current, status: "running", startedAt }, lease)
      const finalState = await runWithModelExecution({ owner: manifest.id, admission, signal,
        assertActive: () => { lease.assertActive(); options.parent?.assertActive() },
        onModelCallFailure: failure => emit({ type: "model.attempt.failed", runId: manifest.id, timestamp: new Date().toISOString(), failure }),
      }, () => runSimulation({
        runId: manifest.id, scenario, settings, roundDelayMs: 5000,
        waitForNextRound: options.waitForNextRound ?? (roundIndex => roundContinuations.wait(manifest.id, roundIndex, approvals, lease)),
        commentary: options.commentary, isCanceled: () => signal.aborted,
        saveState: state => { options.parent?.assertActive(); return store.writeState(state, lease) },
        emit: async event => { await emit(event); await options.onEvent?.(event) },
      }))
      signal.throwIfAborted()
      options.parent?.assertActive()
      await store.writeState(finalState, lease)
      await store.writeManifest({ ...current, status: "completed", startedAt,
        completedAt: new Date().toISOString(), stopReason: finalState.stopReason }, lease)
    } catch (error) {
      await publishGenerationFailure(error, signal, async canceled => {
        const message = error instanceof Error ? error.message : "Run failed."
        await emit(canceled ? { type: "run.canceled", runId: manifest.id, timestamp: new Date().toISOString() }
          : { type: "run.failed", runId: manifest.id, timestamp: new Date().toISOString(), error: message })
        await store.writeManifest({ ...current, status: canceled ? "canceled" : "failed", startedAt,
          completedAt: new Date().toISOString(), stopReason: canceled ? "canceled" : "failed",
          ...(canceled ? {} : { error: message }) }, lease)
      })
    }
  })
}
