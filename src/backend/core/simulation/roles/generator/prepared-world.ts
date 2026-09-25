/**
 * Purpose: Initialize runtime actors from confirmed world profiles without regenerating their identities.
 * Pattern: Deterministic actor-state assembly.
 * Usage: Used by Generator for prepared world scenarios.
 * Related: src/backend/core/simulation/roles/generator/nodes.ts, src/shared/world-story.ts
 */
import type { ActionCatalog, ActorRosterEntry, ActorState } from "@/shared"
import type { WorldStory } from "@/shared/world-story"
import { buildActor } from "./state"

export function preparedWorldRoster(world: WorldStory): ActorRosterEntry[] {
  return world.participants.map((participant, index) => ({ index: index + 1, name: participant.name, roleSeed: participant.authority }))
}

export function preparedWorldActors(world: WorldStory, catalog: ActionCatalog): ActorState[] {
  return world.participants.map((participant, index) => {
    const actor = buildActor(index + 1, {
      name: participant.name, role: participant.authority, personality: participant.personality,
      backgroundHistory: participant.initialPosition, preference: participant.goal,
    }, world.opening.summary, catalog)
    return { ...actor, privateGoal: participant.privateConcern,
      knownSourceFacts: participant.knownSourceFacts.map(({ id, text, evidenceIds }) => ({ id, text, evidenceIds: [...evidenceIds] })),
      contextSummary: participant.privateConcern,
      intent: participant.initialPosition, context: { visible: [{ id: `${world.id}:${participant.id}:initial`, kind: "self", roundIndex: 0, content: participant.initialPosition }] } }
  })
}
