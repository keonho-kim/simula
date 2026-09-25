/**
 * Purpose: Assemble actor rosters and runtime cards from text scenarios or prepared world profiles.
 * Pattern: Generator workflow nodes.
 * Usage: Called by the Generator LangGraph after Planner establishes the action catalog.
 * Related: src/backend/core/simulation/roles/generator/prepared-world.ts, src/backend/core/simulation/roles/generator/cards/graph.ts
 */
import type { ActorRosterEntry, RunEvent } from "@/shared"
import { preparedWorldActors, preparedWorldRoster } from "./prepared-world"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import { plannerDigestSummary } from "@/backend/core/simulation/planning/digest"
import { buildActor, type ActorCard } from "@/backend/core/simulation/roles/generator/state"
import { runActorCardGraph } from "@/backend/core/simulation/roles/generator/cards/graph"
import { createActorRoster } from "@/backend/core/simulation/roles/generator/roster"

export function createGeneratorRosterNode(
  emit: (event: RunEvent) => Promise<void>
): (state: WorkflowState) => Promise<Partial<WorkflowState>> {
  return async (state) => {
    const plannerDigest = plannerDigestSummary(state.simulation.plan, state.scenario.text)
    const actorRoster = state.scenario.world ? preparedWorldRoster(state.scenario.world) : await createActorRoster(state, plannerDigest, emit)
    await emit({ type: "board.updated", runId: state.runId, timestamp: new Date().toISOString(),
      update: { kind: "roster", actors: actorRoster } })

    return {
      simulation: {
        ...state.simulation,
        actorRoster,
      },
    }
  }
}

export function createGeneratorCardsNode(
  emit: (event: RunEvent) => Promise<void>
): (state: WorkflowState) => Promise<Partial<WorkflowState>> {
  return async (state) => {
    const plannerDigest = plannerDigestSummary(state.simulation.plan, state.scenario.text)
    const actorRoster = state.simulation.actorRoster
    if (!actorRoster?.length) {
      throw new Error("generator.cards requires generator.roster to complete first.")
    }
    const catalog = state.simulation.plan?.actionCatalog
    if (!catalog || !Object.keys(catalog).length) throw new Error("generator.cards requires planner.actionCatalog first.")
    if (state.scenario.world) {
      const actors = preparedWorldActors(state.scenario.world, catalog)
      for (const actor of actors) await emit({ type: "board.updated", runId: state.runId, timestamp: new Date().toISOString(),
        update: { kind: "actor", id: actor.id, card: { name: actor.name, role: actor.role, personality: actor.personality, backgroundHistory: actor.backgroundHistory, preference: actor.preference } } })
      return { simulation: { ...state.simulation, actors } }
    }
    const cards = state.scenario.controls.fastMode
      ? await Promise.all(actorRoster.map((entry) => runActorCardGraphForEntry(state, entry, actorRoster, plannerDigest, emit)))
      : await runActorCardsSequentially(state, actorRoster, plannerDigest, emit)
    const actors = cards.map((card, index) =>
      buildActor(actorRoster[index]?.index ?? index + 1, card, plannerDigest, catalog)
    )

    return {
      simulation: {
        ...state.simulation,
        actors,
      },
    }
  }
}

async function runActorCardsSequentially(
  state: WorkflowState,
  actorRoster: ActorRosterEntry[],
  plannerDigest: string,
  emit: (event: RunEvent) => Promise<void>
): Promise<ActorCard[]> {
  const cards = []
  for (const entry of actorRoster) {
    cards.push(await runActorCardGraphForEntry(state, entry, actorRoster, plannerDigest, emit))
  }
  return cards
}

async function runActorCardGraphForEntry(
  state: WorkflowState,
  entry: ActorRosterEntry,
  fullRoster: ActorRosterEntry[],
  plannerDigest: string,
  emit: (event: RunEvent) => Promise<void>
) {
  await emit({ type: "board.updated", runId: state.runId, timestamp: new Date().toISOString(),
    update: { kind: "actor.started", id: "actor-" + entry.index } })
  const card = await runActorCardGraph({
    context: {
      runId: state.runId,
      language: state.scenario.language,
      actorIndex: entry.index,
      assignedName: entry.name,
      roleSeed: entry.roleSeed,
      fullRoster,
      plannerDigest,
    },
    settings: state.settings,
    emit,
  })
  await emit({ type: "board.updated", runId: state.runId, timestamp: new Date().toISOString(),
    update: { kind: "actor", id: "actor-" + entry.index, card } })
  return card
}
