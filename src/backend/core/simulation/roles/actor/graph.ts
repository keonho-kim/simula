import { END, START, StateGraph } from "@langchain/langgraph"
import type { RunEvent } from "@/shared"
import { actorNode, createActorStepNode } from "@/backend/core/simulation/roles/actor/nodes"
import { ActorAnnotation } from "@/backend/core/simulation/roles/actor/state"

export function createActorGraph(emit: (event: RunEvent) => Promise<void>) {
  return new StateGraph(ActorAnnotation)
    .addNode("actor.thought", createActorStepNode("thought", emit))
    .addNode("actor.target", createActorStepNode("target", emit))
    .addNode("actor.action", createActorStepNode("action", emit))
    .addNode("actor.intent", createActorStepNode("intent", emit))
    .addNode("actor.message", createActorStepNode("message", emit))
    .addNode("actor.apply", actorNode)
    .addEdge(START, "actor.thought")
    .addEdge("actor.thought", "actor.action")
    .addEdge("actor.action", "actor.target")
    .addEdge("actor.target", "actor.intent")
    .addEdge("actor.intent", "actor.message")
    .addEdge("actor.message", "actor.apply")
    .addEdge("actor.apply", END)
    .compile()
}
