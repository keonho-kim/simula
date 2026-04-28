import { END, START, Annotation, StateGraph } from "@langchain/langgraph"
import type {
  ActorDecision,
  ActorState,
  CoordinatorTrace,
  LLMSettings,
  PlannedEvent,
  RoundDigest,
  RunEvent,
  ScenarioInput,
} from "@simula/shared"
import { actorNode, createActorStepNode } from "./nodes"
import { initialActorTrace, type ActorGraphState, type ActorTrace } from "./state"

const ActorAnnotation = Annotation.Root({
  runId: Annotation<string>(),
  scenario: Annotation<ScenarioInput>(),
  plannerDigest: Annotation<string>(),
  settings: Annotation<LLMSettings>(),
  actor: Annotation<ActorState>(),
  actors: Annotation<ActorState[]>(),
  event: Annotation<PlannedEvent>(),
  roundDigest: Annotation<RoundDigest>(),
  roundIndex: Annotation<number>(),
  coordinatorTrace: Annotation<CoordinatorTrace>(),
  trace: Annotation<ActorTrace>(),
  decision: Annotation<ActorDecision | undefined>(),
})

export function createActorGraph(emit: (event: RunEvent) => Promise<void>) {
  return new StateGraph(ActorAnnotation)
    .addNode("actor.thought", createActorStepNode("thought", emit))
    .addNode("actor.target", createActorStepNode("target", emit))
    .addNode("actor.action", createActorStepNode("action", emit))
    .addNode("actor.intent", createActorStepNode("intent", emit))
    .addNode("actor.message", createActorStepNode("message", emit))
    .addNode("actor.apply", actorNode)
    .addEdge(START, "actor.thought")
    .addEdge("actor.thought", "actor.target")
    .addEdge("actor.target", "actor.action")
    .addEdge("actor.action", "actor.intent")
    .addEdge("actor.intent", "actor.message")
    .addEdge("actor.message", "actor.apply")
    .addEdge("actor.apply", END)
    .compile()
}

export function createActorGraphState(input: Omit<ActorGraphState, "trace" | "decision">): ActorGraphState {
  return {
    ...input,
    trace: initialActorTrace(),
  }
}
