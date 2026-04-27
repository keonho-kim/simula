import type { RunEvent } from "@simula/shared"
import { summarizeEvents, summarizeInteractions } from "../../reporting"
import type { WorkflowState } from "../../state"
import { getRoleTrace } from "../shared"
import { buildCoordinatorInteractions } from "./state"

export async function coordinatorNode(
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>
): Promise<Partial<WorkflowState>> {
  const trace = getRoleTrace(state, "coordinator")
  const events = state.simulation.plan?.majorEvents ?? []
  const actors = state.simulation.actors.map((actor) => ({ ...actor }))
  const result = buildCoordinatorInteractions(events, actors, trace)

  for (const interaction of result.interactions) {
    const actor = result.actors.find((item) => item.id === interaction.sourceActorId)
    if (!actor) {
      continue
    }

    await emit({
      type: "actor.message",
      runId: state.runId,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      content: interaction.content,
    })
  }

  const worldSummary = `${summarizeInteractions(result.interactions)} ${summarizeEvents(events)}`
  await emit({
    type: "log",
    runId: state.runId,
    timestamp: new Date().toISOString(),
    level: "info",
    message: worldSummary,
  })

  return {
    simulation: {
      ...state.simulation,
      actors: result.actors,
      interactions: result.interactions,
      roundDigests: result.roundDigests,
      worldSummary,
      stopReason: "simulation_done",
    },
  }
}
