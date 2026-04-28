import { Annotation, END, START, StateGraph } from "@langchain/langgraph"
import type { ActorCardStep, ActorRosterEntry, LLMSettings, RunEvent, ScenarioInput } from "@simula/shared"
import { actorCardPrompts } from "./card-prompts"
import { createActorCardStepNode } from "./card-node"
import { completeActorCard, initialActorCardState, type ActorCardGraphState } from "./card-state"
import type { ActorCard } from "./state"

const ActorCardAnnotation = Annotation.Root({
  runId: Annotation<string>(),
  scenario: Annotation<ScenarioInput>(),
  settings: Annotation<LLMSettings>(),
  actorIndex: Annotation<number>(),
  assignedName: Annotation<string>(),
  roleSeed: Annotation<string>(),
  fullRoster: Annotation<ActorRosterEntry[]>(),
  plannerDigest: Annotation<string>(),
  card: Annotation<Partial<ActorCard>>(),
  retryCounts: Annotation<Record<ActorCardStep, number>>(),
  emit: Annotation<(event: RunEvent) => Promise<void>>(),
})

export function createActorCardGraph() {
  return new StateGraph(ActorCardAnnotation)
    .addNode("actor-card.role", createActorCardStepNode("role", actorCardPrompts.role))
    .addNode(
      "actor-card.backgroundHistory",
      createActorCardStepNode("backgroundHistory", actorCardPrompts.backgroundHistory)
    )
    .addNode("actor-card.personality", createActorCardStepNode("personality", actorCardPrompts.personality))
    .addNode("actor-card.preference", createActorCardStepNode("preference", actorCardPrompts.preference))
    .addEdge(START, "actor-card.role")
    .addEdge("actor-card.role", "actor-card.backgroundHistory")
    .addEdge("actor-card.backgroundHistory", "actor-card.personality")
    .addEdge("actor-card.personality", "actor-card.preference")
    .addEdge("actor-card.preference", END)
    .compile()
}

export async function runActorCardGraph(
  input: Omit<ActorCardGraphState, "card" | "retryCounts">
): Promise<ActorCard> {
  const result = await createActorCardGraph().invoke(initialActorCardState(input))
  return completeActorCard(result)
}
