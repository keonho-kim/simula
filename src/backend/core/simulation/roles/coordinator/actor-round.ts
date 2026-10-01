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
import { createActorContext, createActorGraph, createActorGraphState } from "@/backend/core/simulation/roles/actor"

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
    let publishing = true
    const results = await Promise.all(
      batch.map(async (actor) => {
        await emit({ type: "actor.progress", runId: state.runId, timestamp: timestamp(), update: { kind: "started", roundIndex, actorId: actor.id } })
        const result = await runActorGraph(
          state, snapshot, actor.id, event, roundDigest, roundIndex, coordinatorTrace, emit
        )
        if (publishing) {
          const interaction = buildInteraction(roundIndex, event, actor, snapshot, result.decision, state.scenario.language)
          await emit({ type: "actor.progress", runId: state.runId, timestamp: timestamp(), update: { kind: "ready", roundIndex, message: {
            id: interaction.id, actorId: actor.id, actorName: actor.name, role: actor.role,
            targets: interaction.targetActorIds.map(id => snapshot.find(actor => actor.id === id)?.name ?? id),
            action: interaction.actionType, content: interaction.content, visibility: interaction.visibility, decisionType: interaction.decisionType,
          } } })
        }
        return result
      })
    ).finally(() => { publishing = false })
    for (const result of results) {
      const currentActor = nextActors.find((actor) => actor.id === result.actorId)
      if (!currentActor) continue
      nextActors = applyActorDecision(nextActors, result.decision)
      const interaction = buildInteraction(roundIndex, event, currentActor, nextActors, result.decision, state.scenario.language)
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
  actorId: string,
  event: PlannedEvent,
  roundDigest: RoundDigest,
  roundIndex: number,
  coordinatorTrace: CoordinatorTrace,
  emit: (event: RunEvent) => Promise<void>
): Promise<ActorGraphResult> {
  const actor = actors.find(candidate => candidate.id === actorId)
  if (!actor) throw new Error(`Actor ${actorId} is absent from the current round snapshot.`)
  const context = createActorContext({
    runId: state.runId,
    scenario: state.scenario,
    plannerDigest: plannerDigestSummary(state.simulation.plan, state.scenario.text),
    actor,
    actors,
    event,
    roundDigest,
    roundIndex,
    coordinatorTrace,
  })
  const result = await createActorGraph(context, state.settings, emit).invoke(createActorGraphState())
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
  if (decision.visibility !== "solitary" && decision.message) {
    await emit({
      type: "actor.message",
      runId,
      timestamp: timestamp(),
      actorId: actor.id,
      actorName: actor.name,
      content: decision.message,
      interactionId: interaction.id,
      roundIndex: interaction.roundIndex,
    })
  }
}

function timestamp(): string {
  return new Date().toISOString()
}
