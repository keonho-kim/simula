/**
 * Purpose: Assemble final simulation artifacts and generate commentary when requested.
 * Pattern: Workflow finalization node.
 * Usage: Called after simulation rounds; batch worlds defer long commentary to aggregate analysis.
 * Related: src/backend/core/simulation/workflow/graph.ts, src/backend/core/simulation/outputs/report.ts
 */
import { generateReportCommentary } from "@/backend/core/simulation/outputs/commentary/workflow"
import type { RunEvent, SimulationState } from "@/shared"
import { renderReport } from "@/backend/core/simulation/outputs/report"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import { emitNodeCompleted, emitNodeStarted, timestamp } from "@/backend/core/simulation/events/telemetry"

export async function finalizationNode(
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>,
  isCanceled?: () => boolean,
  saveReportState?: (state: SimulationState) => Promise<void>,
  commentary: "generate" | "defer" = "generate"
): Promise<Partial<WorkflowState>> {
  await emitNodeStarted(state.runId, "finalization", "Finalization", emit)
  const reportCommentary = commentary === "defer" ? undefined : await generateReportCommentary(state.simulation, state.settings, emit, isCanceled, saveReportState ? async reportCommentary => {
    const snapshot = { ...state.simulation, reportCommentary }
    await saveReportState({ ...snapshot, reportMarkdown: renderReport(snapshot) })
  } : undefined)
  const reportMarkdown = renderReport({ ...state.simulation, reportCommentary })
  await emit({ type: "report.delta", runId: state.runId, timestamp: timestamp(), content: reportMarkdown })
  await emitNodeCompleted(state.runId, "finalization", "Finalization", emit)
  return {
    simulation: {
      ...state.simulation,
      reportMarkdown,
      reportCommentary,
    },
  }
}
