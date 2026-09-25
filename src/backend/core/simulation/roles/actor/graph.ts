/**
 * Purpose: Construct the actor decision graph with only trace and decision in its channels.
 * Pattern: State graph with per-invocation dependencies.
 * Usage: Created by coordinator actor-round with a compact context and runtime model settings.
 * Related: src/backend/core/simulation/roles/actor/state.ts, src/backend/core/simulation/roles/actor/context.ts
 */
import { END, START, StateGraph } from "@langchain/langgraph"
import type { LLMSettings, RunEvent } from "@/shared"
import { actorNode, createActorStepNode } from "@/backend/core/simulation/roles/actor/nodes"
import { ActorAnnotation } from "@/backend/core/simulation/roles/actor/state"

import type { ActorContext } from "./context"

export function createActorGraph(context: ActorContext, settings: LLMSettings, emit: (event: RunEvent) => Promise<void>) {
  return new StateGraph(ActorAnnotation)
    .addNode("actor.thought", createActorStepNode("thought", context, settings, emit))
    .addNode("actor.target", createActorStepNode("target", context, settings, emit))
    .addNode("actor.action", createActorStepNode("action", context, settings, emit))
    .addNode("actor.intent", createActorStepNode("intent", context, settings, emit))
    .addNode("actor.message", createActorStepNode("message", context, settings, emit))
    .addNode("actor.apply", state => actorNode({ ...context, ...state }))
    .addEdge(START, "actor.thought")
    .addEdge("actor.thought", "actor.action")
    .addEdge("actor.action", "actor.target")
    .addEdge("actor.target", "actor.intent")
    .addEdge("actor.intent", "actor.message")
    .addEdge("actor.message", "actor.apply")
    .addEdge("actor.apply", END)
    .compile()
}
