import type { RunEvent } from "@/shared"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import { emitNodeCompleted, emitNodeStarted, timestamp } from "@/backend/core/simulation/events/telemetry"

export async function runStage(
  nodeId: string,
  label: string,
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>,
  graph: { invoke: (state: WorkflowState) => Promise<WorkflowState> }
): Promise<Partial<WorkflowState>> {
  await emitNodeStarted(state.runId, nodeId, label, emit)
  const result = await graph.invoke(state)
  if (nodeId === "generator") {
    await emit({
      type: "actors.ready",
      runId: state.runId,
      timestamp: timestamp(),
      actors: result.simulation.actors.map((actor) => ({
        id: actor.id,
        label: actor.name,
        role: actor.role,
        intent: actor.intent,
        interactionCount: 0,
        backgroundHistory: actor.backgroundHistory,
        personality: actor.personality,
        preference: actor.preference,
        privateGoal: actor.privateGoal,
        contextSummary: actor.contextSummary,
      })),
    })
  }
  await emitNodeCompleted(state.runId, nodeId, label, emit)
  return { simulation: result.simulation }
}
