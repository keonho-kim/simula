/**
 * Purpose: Execute one actor round with causal sequential or deterministic parallel ordering.
 * Pattern: Use case.
 * Usage: Called once per round by coordinator nodes.
 * Related: src/backend/core/simulation/roles/actor/graph.ts, src/backend/core/simulation/actors/interactions.ts
 */
import type {
  ActorDecision,
  ActorState,
  CoordinatorTrace,
  Interaction,
  PlannedEvent,
  RoundDigest,
  RunEvent,
} from "@/shared"
import { applyInteractionContext } from "@/backend/core/simulation/actors/memory"
import { applyActorDecision, buildInteraction } from "@/backend/core/simulation/actors/interactions"
import { plannerDigestSummary } from "@/backend/core/simulation/planning/digest"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import { createActorGraph, createActorGraphState } from "@/backend/core/simulation/roles/actor"

interface ActorGraphResult {
  actorId: string
  decision: ActorDecision
}

interface ActorRoundResult {
  actors: ActorState[]
  interactions: Interaction[]
}

export async function runActorRound(
  state: WorkflowState,
  actors: ActorState[],
  event: PlannedEvent,
  roundDigest: RoundDigest,
  roundIndex: number,
  coordinatorTrace: CoordinatorTrace,
  emit: (event: RunEvent) => Promise<void>
): Promise<ActorRoundResult> {
  let nextActors = actors
  const interactions: Interaction[] = []
  for (const batch of actorExecutionBatches(actors, state.scenario.controls.fastMode)) {
    const snapshot = nextActors
    const results = await Promise.all(
      batch.map((actor) => runActorGraph(
        state,
        snapshot,
        actor,
        event,
        roundDigest,
        roundIndex,
        coordinatorTrace,
        emit
      ))
    )
    for (const result of results) {
      const currentActor = nextActors.find((actor) => actor.id === result.actorId)
      if (!currentActor) continue
      nextActors = applyActorDecision(nextActors, result.decision)
      const interaction = buildInteraction(roundIndex, event, currentActor, nextActors, result.decision)
      interactions.push(interaction)
      nextActors = applyInteractionContext(nextActors, interaction)
      await emitInteraction(state.runId, currentActor, result.decision, interaction, emit)
    }
  }
  return { actors: nextActors, interactions }
}

export function actorExecutionBatches(
  actors: readonly ActorState[],
  fastMode: boolean
): readonly (readonly ActorState[])[] {
  return fastMode ? [actors] : actors.map((actor) => [actor])
}

async function runActorGraph(
  state: WorkflowState,
  actors: ActorState[],
  actor: ActorState,
  event: PlannedEvent,
  roundDigest: RoundDigest,
  roundIndex: number,
  coordinatorTrace: CoordinatorTrace,
  emit: (event: RunEvent) => Promise<void>
): Promise<ActorGraphResult> {
  const result = await createActorGraph(emit).invoke(createActorGraphState({
    runId: state.runId,
    scenario: state.scenario,
    plannerDigest: plannerDigestSummary(state.simulation.plan, state.scenario.text),
    settings: state.settings,
    actor,
    actors,
    event,
    roundDigest,
    roundIndex,
    coordinatorTrace,
  }))
  if (!result.decision) {
    throw new Error(`actor graph for ${actor.id} completed without a decision.`)
  }
  return { actorId: actor.id, decision: result.decision }
}

async function emitInteraction(
  runId: string,
  actor: ActorState,
  decision: ActorDecision,
  interaction: Interaction,
  emit: (event: RunEvent) => Promise<void>
): Promise<void> {
  await emit({ type: "interaction.recorded", runId, timestamp: timestamp(), interaction })
  if (decision.message) {
    await emit({
      type: "actor.message",
      runId,
      timestamp: timestamp(),
      actorId: actor.id,
      actorName: actor.name,
      content: decision.message,
    })
  }
}

function timestamp(): string {
  return new Date().toISOString()
}
