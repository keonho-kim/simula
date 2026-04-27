import type { WorkflowState } from "../../state"
import { getRoleTrace } from "../shared"
import { buildActionCatalog, buildActor } from "./state"

export async function generatorNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const trace = getRoleTrace(state, "generator")
  const backgroundStory = state.simulation.plan?.backgroundStory ?? state.scenario.text
  const actorIndexes = Array.from({ length: state.scenario.controls.numCast }, (_, index) => index + 1)
  const actors = state.scenario.controls.fastMode
    ? await Promise.all(
        actorIndexes.map(async (index) =>
          buildActor(index, backgroundStory, trace, state.scenario.controls.actionsPerType)
        )
      )
    : actorIndexes.map((index) =>
        buildActor(index, backgroundStory, trace, state.scenario.controls.actionsPerType)
      )

  return {
    simulation: {
      ...state.simulation,
      plan: state.simulation.plan
        ? {
            ...state.simulation.plan,
            actionCatalog: buildActionCatalog(actors),
          }
        : state.simulation.plan,
      actors,
    },
  }
}
