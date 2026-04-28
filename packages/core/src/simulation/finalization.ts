import type { RunEvent } from "@simula/shared"
import { renderReport } from "./reporting"
import type { WorkflowState } from "./state"
import { emitNodeCompleted, emitNodeStarted, timestamp } from "./events"

export async function finalizationNode(
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>
): Promise<Partial<WorkflowState>> {
  await emitNodeStarted(state.runId, "finalization", "Finalization", emit)
  const reportMarkdown = renderReport(state.simulation)
  await emit({ type: "report.delta", runId: state.runId, timestamp: timestamp(), content: reportMarkdown })
  await emitNodeCompleted(state.runId, "finalization", "Finalization", emit)
  return {
    simulation: {
      ...state.simulation,
      reportMarkdown,
    },
  }
}

