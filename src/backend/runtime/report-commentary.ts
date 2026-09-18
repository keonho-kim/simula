import type { LLMSettings, SimulationState } from "@/shared"
import type { RunStore } from "@/backend/storage/runs/run-store"
import { generateReportCommentary } from "@/backend/core/simulation/outputs/commentary/workflow"
import { renderReport } from "@/backend/core/simulation/outputs/report"
import { appendAndPublish, type Subscriptions } from "./events"
import type { RoundContinuationStore } from "./round-continuation"

/** Persist every completed frontier; release the shared run lock even on cancellation or I/O failure. */
export async function executeReportCommentary(
  store: RunStore,
  subscriptions: Subscriptions,
  runningRuns: Set<string>,
  continuations: RoundContinuationStore,
  initial: SimulationState,
  settings: LLMSettings
) {
  let state = initial
  try {
    await generateReportCommentary(
      state,
      settings,
      (event) => appendAndPublish(store, subscriptions, event),
      () => continuations.isCanceled(state.runId),
      async (commentary) => {
        state = { ...state, reportCommentary: commentary }
        state.reportMarkdown = renderReport(state)
        await store.writeState(state)
      }
    )
  } catch (error) {
    state = {
      ...state,
      reportCommentary: {
        status: "failed",
        nodes: state.reportCommentary?.nodes ?? [],
        rootId: state.reportCommentary?.rootId
      }
    }
    state.reportMarkdown = renderReport(state)
    await store.writeState(state)
    await appendAndPublish(store, subscriptions, {
      type: "log",
      runId: state.runId,
      timestamp: new Date().toISOString(),
      level: "warn",
      message: `observer.reportCommentary interrupted: ${error instanceof Error ? error.message : "unknown failure"}`
    })
  } finally {
    runningRuns.delete(state.runId)
    continuations.clearRun(state.runId)
  }
}
