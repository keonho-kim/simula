/**
 * Purpose: Convert a validated world story into simulation input without exposing private concerns.
 * Pattern: Deterministic domain handoff.
 * Usage: Called by world runtime when materializing an independent run.
 * Related: src/shared/world-story-schema.ts, src/backend/core/scenario/index.ts
 */
import type { ScenarioInput } from "@/shared/scenario"
import type { ScenarioSpecification } from "@/shared/scenario-builder"
import type { WorldStory } from "@/shared/world-story"
import type { WorldControls } from "@/shared/world-preparation"
import { worldStorySchema } from "@/shared/world-story-schema"
import { normalizeScenarioControls } from "@/backend/core/scenario"
import { assertEvidenceReferences } from "@/backend/core/generation/validation"
import { assertWorldSourceAccess } from "./source-access"

export function scenarioFromWorld(input: WorldStory, source: ScenarioSpecification, controls: Partial<WorldControls>): ScenarioInput {
  const world = worldStorySchema.parse(input)
  if (source.status !== "confirmed" || world.sourceScenarioId !== source.id || world.sourceScenarioVersion !== source.version
    || world.documentSetId !== source.documentSetId || world.documentRevision !== source.documentRevision) throw new Error("World source does not match the confirmed scenario revision.")
  if (world.participants.length !== source.participants.length || world.participants.some((person, index) => {
    const fixed = source.participants[index]
    return person.id !== fixed.id || person.name !== fixed.name || person.personality !== fixed.personality || person.authority !== fixed.authority || person.goal !== fixed.goal
      || person.nameLocked !== fixed.nameLocked || person.personalityLocked !== fixed.personalityLocked || JSON.stringify(person.evidenceIds) !== JSON.stringify(fixed.evidenceIds)
  })) throw new Error("World participants must preserve the confirmed identities and profiles.")
  assertWorldSourceAccess(world, source)
  assertEvidenceReferences(world.opening, new Set(source.sourceEvidenceIds))
  const same = (a: readonly string[], b: readonly string[]) => JSON.stringify(a) === JSON.stringify(b)
  if (!same(world.constraints, [source.facets.constraints.summary]) || !same(world.actionScope, source.rules.actions.entries)
    || !same(world.endConditions, source.rules.termination.entries) || !same(world.allowedVariation, source.rules.variation.entries)) throw new Error("World constraints differ from the confirmed scenario.")
  return {
    sourceName: `${source.situation.title}.md`, language: source.language, world,
    controls: normalizeScenarioControls({ ...controls, numCast: world.participants.length, allowAdditionalCast: false }),
    text: [source.situation.title, source.situation.purpose, source.situation.decision, world.opening.setting, world.opening.summary,
      `Key Actors:\n${world.participants.map(person => `- ${person.name}: ${person.authority}`).join("\n")}`,
      `First agenda:\n${world.agenda.join("\n")}`, `Initial communication:\n${world.informationFlow.join("\n")}`,
      `Fixed constraints:\n${world.constraints.join("\n")}`, `Action scope:\n${world.actionScope.join("\n")}`,
      `Completion conditions:\n${world.endConditions.join("\n")}`,
    ].join("\n\n"),
  }
}
