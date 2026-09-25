/**
 * Purpose: Generate bounded opening, actor starting positions, agenda, and information flow.
 * Pattern: Focused world-generation nodes.
 * Usage: Called by the per-world StoryBuilder graph.
 * Related: src/backend/core/story-builder/world/state.ts, src/backend/core/generation/tasks.ts
 */
import { agendaInstructions } from "./prompts/agenda"
import { informationInstructions } from "./prompts/information"
import { openingSettingInstructions } from "./prompts/opening-setting"
import { openingSummaryInstructions } from "./prompts/opening-summary"
import { openingAssumptionInstructions } from "./prompts/opening-assumption"
import { participantInstructions } from "./prompts/participant"
import { concernInstructions } from "./prompts/concern"
import { rulesSchema } from "@/shared/scenario-builder-schema"
import { MAX_WORLD_UNIT_REFERENCES, worldActorOutputSchema, worldConcernSchema, worldOpeningSchema } from "@/shared/world-story-schema"
import { mapGenerationTasks } from "@/backend/core/generation/tasks"
import type { WorldParticipantRefs, WorldTasks } from "./state"
import { sourceFactsForAudience, worldTaskEvidenceIds } from "./source-access"

export async function buildWorldOpening(tasks: WorldTasks): Promise<string> {
  const { specification: spec, worldId } = tasks.request
  const publicFacts = sourceFactsForAudience(spec, null)
  const evidenceIds = worldTaskEvidenceIds(spec.situation, spec.facets.constraints, spec.rules.variation, ...publicFacts)
  const setting = await tasks.run({ id: "opening-setting", kind: "situation", schema: worldOpeningSchema.shape.setting,
    output: "text", parse: (text: string) => text.trim(),
    shape: "one short sentence describing the public place and starting moment",
    instruction: openingSettingInstructions,
    input: { INFO: { worldId }, SOURCE: { knownFacts: publicFacts },
      SCENARIO: { situation: spec.situation, constraints: spec.facets.constraints, allowedVariation: spec.rules.variation } },
    evidenceIds })
  const summary = await tasks.run({ id: "opening-summary", kind: "situation", schema: worldOpeningSchema.shape.summary,
    output: "text", parse: (text: string) => text.trim(),
    shape: "one short sentence describing the immediate public situation",
    instruction: openingSummaryInstructions,
    input: { INFO: { worldId }, SOURCE: { knownFacts: publicFacts },
      SCENARIO: { situation: spec.situation, constraints: spec.facets.constraints }, SIMULATION: { setting } },
    evidenceIds })
  const assumption = await tasks.run({ id: "opening-assumption", kind: "situation",
    schema: worldOpeningSchema.shape.assumptions.element, output: "text", parse: (text: string) => text.trim(),
    shape: "one short optional opening assumption, or 0 if none",
    instruction: openingAssumptionInstructions,
    input: { SOURCE: { knownFacts: publicFacts }, SCENARIO: { situation: spec.situation,
      allowedVariation: spec.rules.variation }, SIMULATION: { setting, summary } }, evidenceIds })
  const opening = worldOpeningSchema.parse({ setting, summary, assumptions: assumption === "0" ? [] : [assumption],
    evidenceIds: evidenceIds.slice(0, MAX_WORLD_UNIT_REFERENCES) })
  await tasks.dependencies.saveTask({ id: "opening", fingerprint: JSON.stringify(opening), value: opening, attempt: 0 })
  return "opening"
}

export async function buildWorldActors(tasks: WorldTasks, openingRef: string): Promise<WorldParticipantRefs[]> {
  const opening = await tasks.read(openingRef, worldOpeningSchema)
  const spec = tasks.request.specification
  const publicFacts = sourceFactsForAudience(spec, null)
  return mapGenerationTasks(spec.participants, tasks.request.fastMode, async participant => {
    const id = `actor-${participant.id}`
    const knownFacts = sourceFactsForAudience(spec, participant.id)
    const summary = await tasks.run({ id: `${id}-summary`, kind: "participant", scope: { kind: "participant", name: participant.name },
      schema: worldActorOutputSchema.shape.summary, output: "text", parse: (text: string) => text.trim(),
      shape: "one short sentence describing this participant's public initial position",
      instruction: participantInstructions,
      input: { INFO: { worldId: tasks.request.worldId }, SOURCE: { knownFacts: publicFacts },
        SIMULATION: { opening }, ACTOR: { id: participant.id, name: participant.name, authority: participant.authority } },
      evidenceIds: worldTaskEvidenceIds(opening, ...publicFacts) })
    const startingPosition = worldActorOutputSchema.parse({ summary, assumptions: [],
      evidenceIds: worldTaskEvidenceIds(opening, ...publicFacts).slice(0, MAX_WORLD_UNIT_REFERENCES) })
    await tasks.dependencies.saveTask({ id, fingerprint: JSON.stringify(startingPosition), value: startingPosition, attempt: 0 })
    const concernRef = `concern-${participant.id}`
    const goal = await tasks.run({ id: `${concernRef}-goal`, kind: "participant", scope: { kind: "participant", name: participant.name },
      schema: worldConcernSchema.shape.goal, output: "text", parse: (text: string) => text.trim(),
      shape: "one short sentence describing this participant's private immediate concern", instruction: concernInstructions,
      input: { SOURCE: { knownFacts }, SIMULATION: { opening, startingPosition }, ACTOR: { participant } },
      evidenceIds: worldTaskEvidenceIds(opening, startingPosition, participant, ...knownFacts) })
    const concern = worldConcernSchema.parse({ goal,
      evidenceIds: worldTaskEvidenceIds(opening, startingPosition, participant, ...knownFacts).slice(0, MAX_WORLD_UNIT_REFERENCES) })
    await tasks.dependencies.saveTask({ id: concernRef, fingerprint: JSON.stringify(concern), value: concern, attempt: 0 })
    return { participantId: participant.id, publicRef: id, concernRef }
  })
}

export async function buildWorldRules(tasks: WorldTasks, openingRef: string, kind: "agenda" | "information"): Promise<string> {
  const opening = await tasks.read(openingRef, worldOpeningSchema)
  const spec = tasks.request.specification
  const publicFacts = sourceFactsForAudience(spec, null)
  const rule = kind === "agenda" ? spec.rules.termination : spec.rules.information
  await tasks.run({ id: kind, kind: "rules", schema: rulesSchema,
    output: "text", parse: (text: string) => ({ entries: [text.trim()], assumptions: [], evidenceIds: [] }),
    shape: "one short sentence in the requested language",
    instruction: kind === "agenda" ? agendaInstructions : informationInstructions,
    input: { INFO: { worldId: tasks.request.worldId }, SOURCE: { knownFacts: publicFacts },
      SIMULATION: { opening }, SCENARIO: { decision: spec.situation.decision,
      rules: rule,
      participants: spec.participants.map(({ id, name, authority }) => ({ id, name, authority })) } },
    evidenceIds: worldTaskEvidenceIds(opening, spec.situation, rule, ...publicFacts) })
  return kind
}
