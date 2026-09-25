/**
 * Purpose: Prepare each world's initial state independently from one confirmed scenario.
 * Pattern: Compact LangGraph workflow.
 * Usage: Called by world-preparation runtime before creating a simulation run.
 * Related: src/backend/core/story-builder/world/state.ts, src/backend/core/story-builder/world/nodes.ts
 */
import { END, START, StateGraph } from "@langchain/langgraph"
import type { ScenarioSpecification } from "@/shared/scenario-builder"
import { specificationSchema } from "@/shared/scenario-builder-schema"
import { createGenerationTasks, type GenerationDependencies } from "@/backend/core/generation/tasks"
import { assembleWorldStory } from "./assembly"
import { buildWorldActors, buildWorldOpening, buildWorldRules } from "./nodes"
import { initialWorldState, WorldStoryState } from "./state"
import { assertPublicWorldPremises } from "./source-access"

export async function prepareWorldStory(worldId: string, input: ScenarioSpecification, fastMode: boolean, dependencies: GenerationDependencies) {
  const specification = specificationSchema.parse(input)
  if (specification.status !== "confirmed" || specification.issues.some(issue => issue.blocking)) throw new Error("Worlds require a confirmed scenario without blocking issues.")
  assertPublicWorldPremises(specification)
  const tasks = createGenerationTasks({ worldId, specification, language: specification.language, fastMode }, dependencies)
  const graph = new StateGraph(WorldStoryState)
    .addNode("opening", async () => ({ openingRef: await buildWorldOpening(tasks) }))
    .addNode("participants", async state => ({ participantRefs: await buildWorldActors(tasks, state.openingRef) }))
    .addNode("agenda", async state => ({ agendaRef: await buildWorldRules(tasks, state.openingRef, "agenda") }))
    .addNode("information", async state => ({ informationRef: await buildWorldRules(tasks, state.openingRef, "information") }))
    .addNode("ready", async state => {
      if (!state.participantRefs.length || !state.agendaRef || !state.informationRef) throw new Error("World starting units are incomplete.")
      return {}
    })
    .addEdge(START, "opening")
  if (fastMode) {
    graph.addEdge("opening", "participants").addEdge("opening", "agenda").addEdge("opening", "information")
      .addEdge(["participants", "agenda", "information"], "ready")
  } else graph.addEdge("opening", "participants").addEdge("participants", "agenda").addEdge("agenda", "information").addEdge("information", "ready")
  graph.addEdge("ready", END)
  const state = await graph.compile().invoke(initialWorldState(worldId), { signal: dependencies.signal })
  dependencies.signal.throwIfAborted()
  return assembleWorldStory(tasks, state)
}
