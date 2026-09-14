import type { RunEvent } from "@/shared"
import { renderReport } from "@/backend/core/simulation/outputs/report"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import { emitNodeCompleted, emitNodeStarted, timestamp } from "@/backend/core/simulation/events/telemetry"

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

