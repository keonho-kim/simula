/**
 * Purpose: Project confirmed source-fact grants into one world's initial actor knowledge.
 * Pattern: Pure access-policy module.
 * Usage: Called by world generation, assembly, and simulation handoff.
 * Related: src/shared/scenario-builder.ts, src/shared/world-story.ts
 */
import type { KnownSourceFact, ScenarioSpecification } from "@/shared/scenario-builder"
import type { WorldStory } from "@/shared/world-story"
import { restrictedFactsInPublicText } from "@/backend/core/scenario-builder/source-access"

export function sourceFactsForAudience(source: ScenarioSpecification, participantId: string | null): KnownSourceFact[] {
  if (participantId !== null && !source.participants.some(person => person.id === participantId)) throw new Error("Unknown source-fact participant.")
  if (source.sourceFacts.some(fact => fact.audience.kind === "unresolved")) throw new Error("Source access remains unresolved; confirm explicit audiences first.")
  return source.sourceFacts.filter(fact => fact.audience.kind === "public"
    || (participantId !== null && fact.audience.kind === "participants" && fact.audience.participantIds.includes(participantId)))
    .map(({ id, text, evidenceIds }) => ({ id, text, evidenceIds: [...evidenceIds] }))
}

export function assertPublicWorldPremises(source: ScenarioSpecification): void {
  const publicReferences = new Set(source.sourceFacts.filter(fact => fact.audience.kind === "public").flatMap(fact => fact.evidenceIds))
  const restrictedReferences = new Set(source.sourceFacts.filter(fact => fact.audience.kind !== "public").flatMap(fact => fact.evidenceIds)
    .filter(id => !publicReferences.has(id)))
  const shared = [source.situation, source.facets.constraints, ...Object.values(source.rules),
    ...source.participants.map(person => ({ name: person.name, authority: person.authority, evidenceIds: person.evidenceIds }))]
  if (shared.some(unit => unit.evidenceIds.some(id => restrictedReferences.has(id)))) {
    throw new Error("Public world premises cite restricted-only evidence; revise the public scenario fields or their confirmed access grants.")
  }
  const publicTexts = shared.flatMap((unit, index) => textValues(unit).map(text => ({ target: `public-premise-${index}`, text })))
  if (restrictedFactsInPublicText(source.sourceFacts, publicTexts).length) {
    throw new Error("A restricted source fact appears in public scenario premises; revise the confirmed scenario before creating a world.")
  }
}

function textValues(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(textValues)
  return value && typeof value === "object" ? Object.values(value).flatMap(textValues) : []
}

export function worldTaskEvidenceIds(...sources: readonly { evidenceIds: readonly string[] }[]): string[] {
  return [...new Set(sources.flatMap(source => source.evidenceIds))]
}

export function assertWorldSourceAccess(world: WorldStory, source: ScenarioSpecification): void {
  assertPublicWorldPremises(source)
  for (const person of world.participants) {
    const granted = sourceFactsForAudience(source, person.id)
    if (JSON.stringify(person.knownSourceFacts) !== JSON.stringify(granted)) {
      throw new Error("World participant source facts differ from confirmed access grants.")
    }
  }
  const publicTexts = [world.opening.setting, world.opening.summary, ...world.agenda, ...world.informationFlow,
    ...world.constraints, ...world.actionScope, ...world.endConditions, ...world.allowedVariation,
    ...world.assumptions, ...world.opening.assumptions,
    ...world.participants.flatMap(person => [person.initialPosition, ...person.startingAssumptions])]
    .map((text, index) => ({ target: `world-public-${index}`, text }))
  if (restrictedFactsInPublicText(source.sourceFacts, publicTexts).length) {
    throw new Error("A restricted source fact appears in public world text.")
  }
}
