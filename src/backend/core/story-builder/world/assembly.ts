/**
 * Purpose: Assemble an immutable cast-preserving world from accepted starting units.
 * Pattern: Deterministic assembly.
 * Usage: Called after per-world scene and participant generation.
 * Related: src/backend/core/story-builder/world/graph.ts, src/shared/world-story-schema.ts
 */
import type { WorldStory } from "@/shared/world-story"
import { rulesSchema } from "@/shared/scenario-builder-schema"
import { worldActorOutputSchema, worldConcernSchema, worldOpeningSchema, worldStorySchema } from "@/shared/world-story-schema"
import type { WorldGraphState, WorldTasks } from "./state"
import { assertWorldSourceAccess, sourceFactsForAudience } from "./source-access"

export async function assembleWorldStory(tasks: WorldTasks, state: WorldGraphState): Promise<WorldStory> {
  const spec = tasks.request.specification
  const opening = await tasks.read(state.openingRef, worldOpeningSchema)
  const agenda = await tasks.read(state.agendaRef, rulesSchema)
  const information = await tasks.read(state.informationRef, rulesSchema)
  const participants = await Promise.all(spec.participants.map(async (participant, index) => {
    const refs = state.participantRefs[index]
    if (!refs || refs.participantId !== participant.id) throw new Error("World participant task identity changed.")
    const initial = await tasks.read(refs.publicRef, worldActorOutputSchema)
    const concern = await tasks.read(refs.concernRef, worldConcernSchema)
    return { ...structuredClone(participant), initialPosition: initial.summary, privateConcern: concern.goal,
      startingAssumptions: initial.assumptions, knownSourceFacts: sourceFactsForAudience(spec, participant.id) }
  }))
  const world = worldStorySchema.parse({ id: state.worldId, sourceScenarioId: spec.id, sourceScenarioVersion: spec.version,
    documentSetId: spec.documentSetId, documentRevision: spec.documentRevision,
    opening, participants, agenda: agenda.entries, informationFlow: information.entries,
    constraints: [spec.facets.constraints.summary], actionScope: spec.rules.actions.entries,
    endConditions: spec.rules.termination.entries, allowedVariation: spec.rules.variation.entries,
    assumptions: [...opening.assumptions, ...agenda.assumptions, ...information.assumptions],
  })
  assertWorldSourceAccess(world, spec)
  return world
}
