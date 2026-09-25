/**
 * Purpose: Persist legacy commentary frontiers under the run's durable execution owner.
 * Pattern: Execution lifecycle coordinator.
 * Usage: Dispatched by report regeneration after the controller's local active-run check.
 * Related: src/backend/runtime/run-ownership.ts, src/backend/core/simulation/outputs/commentary/workflow.ts
 */
import { runWithModelExecution, type ModelCallAdmission } from "@/backend/integrations/llm/execution-context"
import type { LLMSettings, SimulationState } from "@/shared"
import type { RunStore } from "@/backend/storage/runs/run-store"
import { generateReportCommentary } from "@/backend/core/simulation/outputs/commentary/workflow"
import { renderReport } from "@/backend/core/simulation/outputs/report"
import { appendAndPublish, type Subscriptions } from "./events"
import type { RoundContinuationStore } from "./round-continuation"
import { runWithRunOwnership } from "./run-ownership"
import { publishGenerationFailure } from "./generation/ownership"

export async function executeReportCommentary(store: RunStore, subscriptions: Subscriptions, runningRuns: Set<string>,
  continuations: RoundContinuationStore, initial: SimulationState, settings: LLMSettings, admission: ModelCallAdmission): Promise<void> {
  await runWithRunOwnership(store, initial.runId, runningRuns, continuations, async (lease, signal) => {
    const manifest = await store.readManifest(initial.runId)
    if (!["completed", "failed", "canceled"].includes(manifest.status)) return
    let state = await store.readState(initial.runId) ?? initial
    const emit = (event: import("@/shared").RunEvent) => appendAndPublish(store, subscriptions, event, lease)
    try {
      state = { ...state, reportCommentary: { ...state.reportCommentary, status: "running", nodes: state.reportCommentary?.nodes ?? [] } }
      await store.writeState(state, lease)
      await runWithModelExecution({ owner: state.runId, admission, signal, assertActive: () => lease.assertActive(),
        onModelCallFailure: failure => emit({ type: "model.attempt.failed", runId: state.runId, timestamp: new Date().toISOString(), failure }),
      }, () => generateReportCommentary(state, settings, emit, () => signal.aborted, async commentary => {
        state = { ...state, reportCommentary: commentary }
        state.reportMarkdown = renderReport(state)
        await store.writeState(state, lease)
      }))
    } catch (error) {
      await publishGenerationFailure(error, signal, async () => {
        state = { ...state, reportCommentary: { status: "failed", nodes: state.reportCommentary?.nodes ?? [], rootId: state.reportCommentary?.rootId } }
        state.reportMarkdown = renderReport(state)
        await store.writeState(state, lease)
        await emit({ type: "log", runId: state.runId, timestamp: new Date().toISOString(), level: "warn",
          message: `observer.reportCommentary interrupted: ${error instanceof Error ? error.message : "unknown failure"}` })
      })
    }
  })
}
