import type { ActorRosterEntry, RunEvent } from "@simula/shared"
import type { WorkflowState } from "../../state"
import { plannerDigestSummary } from "../../plan"
import { buildActionCatalog, buildActor, type ActorCard } from "./state"
import { runActorCardGraph } from "./card-graph"
import { createActorRoster } from "./roster"

export function createGeneratorRosterNode(
  emit: (event: RunEvent) => Promise<void>
): (state: WorkflowState) => Promise<Partial<WorkflowState>> {
  return async (state) => {
    const plannerDigest = plannerDigestSummary(state.simulation.plan, state.scenario.text)
    const actorRoster = await createActorRoster(state, plannerDigest, emit)

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
    const cards = state.scenario.controls.fastMode
      ? await Promise.all(actorRoster.map((entry) => runActorCardGraphForEntry(state, entry, actorRoster, plannerDigest, emit)))
      : await runActorCardsSequentially(state, actorRoster, plannerDigest, emit)
    const actors = cards.map((card, index) =>
      buildActor(actorRoster[index]?.index ?? index + 1, card, plannerDigest, state.scenario.controls.actionsPerType)
    )

    return {
      simulation: {
        ...state.simulation,
        plan: state.simulation.plan
          ? {
              ...state.simulation.plan,
              actionCatalog: buildActionCatalog(actors),
            }
          : state.simulation.plan,
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

function runActorCardGraphForEntry(
  state: WorkflowState,
  entry: ActorRosterEntry,
  fullRoster: ActorRosterEntry[],
  plannerDigest: string,
  emit: (event: RunEvent) => Promise<void>
) {
  return runActorCardGraph({
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
}
