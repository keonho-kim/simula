import type { ActorRosterEntry, RunEvent } from "@/shared"
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
    const actorRoster = await createActorRoster(state, plannerDigest, emit)
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
  const card = await runActorCardGraph({
    runId: state.runId,
    scenario: state.scenario,
    settings: state.settings,
    actorIndex: entry.index,
    assignedName: entry.name,
    roleSeed: entry.roleSeed,
    fullRoster,
    plannerDigest,
    emit,
  })
  await emit({ type: "board.updated", runId: state.runId, timestamp: new Date().toISOString(),
    update: { kind: "actor", id: "actor-" + entry.index, card } })
  return card
}
