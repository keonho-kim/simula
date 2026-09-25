/**
 * Purpose: Project one actor's decision context without full histories, source bodies or runtime settings.
 * Pattern: Pure working-context projection.
 * Usage: Built by the coordinator before constructing each actor graph.
 * Related: src/backend/core/simulation/roles/actor/state.ts, src/backend/core/simulation/actors/memory.ts
 */
import type { ActorAction, ActorState, CoordinatorTrace, PlannedEvent, RoundDigest, ScenarioInput } from "@/shared"
import { actorPromptContext, contextUsedByActor } from "../../actors/memory"
import { projectEventForActor, UNDISCLOSED_EVENT_CONTEXT } from "../../events/injection"

type ActorProfile = Pick<ActorState, "id" | "name" | "role" | "backgroundHistory" | "personality" | "preference" | "privateGoal" | "knownSourceFacts" | "actions">
export type ActorPublicContext = Pick<ActorState, "id" | "name" | "role" | "backgroundHistory"> & {
  actions: Pick<ActorAction, "id" | "label">[]
}

export interface ActorContext {
  runId: string
  scenario: Pick<ScenarioInput, "language" | "controls">
  plannerDigest: string
  actor: ActorProfile
  actors: ActorPublicContext[]
  history: string
  contextUsed: string[]
  event: Pick<PlannedEvent, "title" | "summary">
  roundDigest: Pick<RoundDigest, "preRound">
  roundIndex: number
  coordinatorTrace: Pick<CoordinatorTrace, "runtimeFrame" | "actorRouting" | "interactionPolicy" | "outcomeDirection">
}

export function createActorContext(input: { runId: string; scenario: ScenarioInput; plannerDigest: string; actor: ActorState;
  actors: ActorState[]; event: PlannedEvent; roundDigest: RoundDigest; roundIndex: number; coordinatorTrace: CoordinatorTrace }): ActorContext {
  const { actor, coordinatorTrace } = input
  const projectedEvent = projectEventForActor(input.event, actor.id)
  return {
    runId: input.runId,
    scenario: { language: input.scenario.language, controls: { ...input.scenario.controls } },
    plannerDigest: input.plannerDigest,
    actor: { id: actor.id, name: actor.name, role: actor.role, backgroundHistory: actor.backgroundHistory,
      personality: actor.personality, preference: actor.preference, privateGoal: actor.privateGoal,
      knownSourceFacts: actor.knownSourceFacts?.map(({ id, text, evidenceIds }) => ({ id, text, evidenceIds: [...evidenceIds] })),
      actions: actor.actions.map(action => ({ ...action })) },
    actors: input.actors.map(peer => ({ id: peer.id, name: peer.name, role: peer.role, backgroundHistory: peer.backgroundHistory,
      actions: peer.actions.map(action => ({ id: action.id, label: action.label })) })),
    history: actorPromptContext(actor, input.scenario.controls),
    contextUsed: contextUsedByActor(actor),
    event: { title: projectedEvent.event.title, summary: projectedEvent.event.summary },
    roundDigest: { preRound: { ...input.roundDigest.preRound,
      content: projectedEvent.visible ? input.roundDigest.preRound.content : UNDISCLOSED_EVENT_CONTEXT } },
    roundIndex: input.roundIndex,
    coordinatorTrace: { runtimeFrame: coordinatorTrace.runtimeFrame, actorRouting: coordinatorTrace.actorRouting,
      interactionPolicy: coordinatorTrace.interactionPolicy, outcomeDirection: coordinatorTrace.outcomeDirection },
  }
}
