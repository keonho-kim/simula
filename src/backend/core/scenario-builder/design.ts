/**
 * Purpose: Construct the shared decision context and preserve participant constraints.
 * Pattern: Bounded generation nodes.
 * Usage: Called by scenario graph nodes after evidence acceptance.
 * Related: src/backend/core/scenario-builder/graph.ts, src/shared/scenario-builder-schema.ts
 */
import { facetInstructions } from "./prompts/facet"
import { situationTitleInstructions } from "./prompts/situation/title"
import { situationPurposeInstructions } from "./prompts/situation/purpose"
import { situationDecisionInstructions } from "./prompts/situation/decision"
import { situationSettingInstructions } from "./prompts/situation/setting"
import { buildRoster } from "./roster"
import { personalityInstructions } from "./prompts/participant/personality"
import { authorityInstructions } from "./prompts/participant/authority"
import { goalInstructions } from "./prompts/participant/goal"
import { ruleInstructions } from "./prompts/rule"
import { digestSchema, facetSchema, participantSchema, rulesSchema, situationSchema, storedParticipantSchema } from "@/shared/scenario-builder-schema"
import { summaryEvidenceIds } from "./evidence"
import { mapGenerationTasks } from "@/backend/core/generation/tasks"
import type { BuilderTasks } from "./contracts"

export const FACETS = ["goals", "constraints", "tensions"] as const
export const RULES = ["information", "actions", "termination", "variation"] as const

export async function buildFacets(tasks: BuilderTasks, digestRef: string): Promise<string[]> {
  const digest = await tasks.read(digestRef, digestSchema)
  return mapGenerationTasks(FACETS, tasks.request.fastMode, async facet => {
    const id = `facet-${facet}`
    await tasks.run({ id, kind: "facet", scope: { kind: "facet", key: facet }, schema: facetSchema,
      output: "text", parse: (text: string) => ({ summary: text.trim(), assumptions: [text.trim()], evidenceIds: [] }),
      shape: "one concise scenario assumption in the requested language",
      instruction: facetInstructions(facet),
      input: { SOURCE: { digest }, USER_INPUT: { context: tasks.request.context, situation: tasks.request.situation } }, evidenceIds: summaryEvidenceIds(digest) })
    return id
  })
}

export async function buildSituation(tasks: BuilderTasks, digestRef: string, facetRefs: string[]): Promise<string> {
  const digest = await tasks.read(digestRef, digestSchema)
  const facets = await Promise.all(facetRefs.map(ref => tasks.read(ref, facetSchema)))
  const fields = [
    { key: "title", instruction: situationTitleInstructions, schema: situationSchema.shape.title },
    { key: "purpose", instruction: situationPurposeInstructions, schema: situationSchema.shape.purpose },
    { key: "decision", instruction: situationDecisionInstructions, schema: situationSchema.shape.decision },
    { key: "setting", instruction: situationSettingInstructions, schema: situationSchema.shape.setting },
  ] as const
  const values = await mapGenerationTasks(fields, tasks.request.fastMode, async field => tasks.run({
    id: `situation-${field.key}`, kind: "situation", schema: field.schema,
    output: "text", parse: (text: string) => text.trim(), shape: "one short sentence in the requested language",
    instruction: field.instruction,
    input: { SOURCE: { digest }, SCENARIO: { facets }, USER_INPUT: { context: tasks.request.context,
      preset: tasks.request.situation, participants: tasks.request.participants.map(value => value.name) } },
    evidenceIds: summaryEvidenceIds(digest),
  }))
  const situation = situationSchema.parse({ title: values[0], purpose: values[1], decision: values[2], setting: values[3],
    assumptions: [], evidenceIds: [] })
  await tasks.dependencies.saveTask({ id: "situation", fingerprint: JSON.stringify(situation), value: situation, attempt: 0 })
  return "situation"
}

export async function buildParticipants(tasks: BuilderTasks, situationRef: string): Promise<string[]> {
  const situation = await tasks.read(situationRef, situationSchema)
  const requested = tasks.request.participants
  const names = requested.length ? requested.map(value => value.name) : await buildRoster(tasks, situation)
  return mapGenerationTasks(names, tasks.request.fastMode, async (name, index) => {
    const id = `participant-${index + 1}`
    const locked = requested[index]?.personality
    const scenario = { situation, otherParticipants: names.filter(value => value !== name) }
    const common = { kind: "participant" as const, scope: { kind: "participant" as const, name },
      evidenceIds: situation.evidenceIds, output: "text" as const,
      parse: (text: string) => text.trim(), shape: "one short sentence in the requested language" }
    const personality = locked ?? await tasks.run({ ...common, id: `${id}-personality`, schema: participantSchema.shape.personality,
      instruction: personalityInstructions, input: { SCENARIO: scenario, ACTOR: { name } } })
    const authority = await tasks.run({ ...common, id: `${id}-authority`, schema: participantSchema.shape.authority,
      instruction: authorityInstructions,
      input: { SCENARIO: scenario, ACTOR: { name, personality }, ...(locked ? { USER_INPUT: { personality: locked } } : {}) } })
    const goal = await tasks.run({ ...common, id: `${id}-goal`, schema: participantSchema.shape.goal,
      instruction: goalInstructions, input: { SCENARIO: scenario, ACTOR: { name, personality, authority } } })
    const participant = storedParticipantSchema.parse({ id, name, personality, authority, goal, evidenceIds: [],
      nameLocked: requested.length > 0, personalityLocked: !!locked })
    // Assembly owns identity and locked fields; the model cannot rename or overwrite them.
    await tasks.dependencies.saveTask({ id, fingerprint: JSON.stringify(participant), value: participant, attempt: 0 })
    return id
  })
}

export async function buildRules(tasks: BuilderTasks, situationRef: string, participantRefs: string[]): Promise<string[]> {
  const situation = await tasks.read(situationRef, situationSchema)
  const participants = await Promise.all(participantRefs.map(ref => tasks.read(ref, storedParticipantSchema)))
  return mapGenerationTasks(RULES, tasks.request.fastMode, async rule => {
    const id = `rule-${rule}`
    await tasks.run({ id, kind: "rules", scope: { kind: "rule", key: rule }, schema: rulesSchema,
      output: "text", parse: (text: string) => ({ entries: [text.trim()], assumptions: [], evidenceIds: [] }),
      shape: "one concise rule sentence in the requested language",
      instruction: ruleInstructions(rule),
      input: { SCENARIO: { situation, participants: participants.map(({ id, name, authority }) => ({ id, name, authority })) } },
      evidenceIds: situation.evidenceIds })
    return id
  })
}
