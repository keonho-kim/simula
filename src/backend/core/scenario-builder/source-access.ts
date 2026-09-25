/**
 * Purpose: Assign validated participant audiences to exact source claims in one shared scenario.
 * Pattern: Bounded generation use case and boundary parser.
 * Usage: Called after shared participants and information rules, then read during review assembly.
 * Related: src/backend/core/scenario-builder/graph.ts, src/shared/scenario-builder-schema.ts
 */
import type { GroundedSummary, SourceFactAccess } from "@/shared/scenario-builder"
import type { ScenarioParticipant } from "@/shared/participants"
import { digestSchema, rulesSchema, sourceFactAudienceSchema, storedParticipantSchema } from "@/shared/scenario-builder-schema"
import { sourceAccessInstructions } from "./prompts/source-access"
import { mapGenerationTasks } from "@/backend/core/generation/tasks"
import type { BuilderTasks } from "./contracts"

export const SOURCE_ACCESS_REF = "source-access"

function sourceFactId(index: number): string { return `fact-${index + 1}` }
export function sourceAudienceTaskId(factId: string): string { return `${SOURCE_ACCESS_REF}-${factId}` }

export function parseSourceAudienceChoice(text: string, participants: readonly Pick<ScenarioParticipant, "id">[]): SourceFactAccess["audience"] {
  const answer = text.trim()
  if (answer === "0") return { kind: "public" }
  if (answer === "?") return { kind: "unresolved" }
  if (!/^[1-9]\d*(?:\s*,\s*[1-9]\d*)*$/.test(answer)) throw new Error("Return only 0, ?, or distinct participant numbers separated by commas.")
  const indices = answer.split(",").map(value => Number(value.trim()))
  if (new Set(indices).size !== indices.length || indices.some(index => !Number.isSafeInteger(index) || index > participants.length)) {
    throw new Error("Use distinct participant numbers from the supplied list.")
  }
  if (indices.length === participants.length) return { kind: "public" }
  return { kind: "participants", participantIds: participants.filter((_, index) => indices.includes(index + 1)).map(value => value.id) }
}

export async function buildSourceAccess(tasks: BuilderTasks, digestRef: string, participantRefs: string[], informationRuleRef: string): Promise<string> {
  const digest = await tasks.read(digestRef, digestSchema)
  const participants = await Promise.all(participantRefs.map(ref => tasks.read(ref, storedParticipantSchema)))
  const informationRule = await tasks.read(informationRuleRef, rulesSchema)
  const assign = async (claim: GroundedSummary["claims"][number], index: number) => {
    const factId = sourceFactId(index)
    await tasks.run({ id: sourceAudienceTaskId(factId), kind: "source-access", schema: sourceFactAudienceSchema,
      output: "choice", parse: (text: string) => parseSourceAudienceChoice(text, participants), shape: "0, ?, or comma-separated participant numbers (1 to the number of participants)",
      instruction: sourceAccessInstructions,
      input: { SOURCE: { factId, text: claim.text }, SCENARIO: { informationRule: informationRule.entries,
        participants: participants.map(({ name, authority }, position) => ({ number: position + 1, name, authority })) } },
      evidenceIds: claim.evidenceIds })
  }
  await mapGenerationTasks(digest.claims, tasks.request.fastMode, assign)
  return SOURCE_ACCESS_REF
}

export async function readSourceFacts(tasks: BuilderTasks, digestRef: string, participantRefs: string[], accessRef: string): Promise<SourceFactAccess[]> {
  const digest = await tasks.read(digestRef, digestSchema)
  if (accessRef !== SOURCE_ACCESS_REF) throw new Error("Unknown source access reference.")
  const participants = await Promise.all(participantRefs.map(ref => tasks.read(ref, storedParticipantSchema)))
  return Promise.all(digest.claims.map(async (claim, index) => {
    const id = sourceFactId(index)
    const audience = await tasks.read(sourceAudienceTaskId(id), sourceFactAudienceSchema)
    if (audience.kind === "participants" && (new Set(audience.participantIds).size !== audience.participantIds.length
      || audience.participantIds.some(value => !participants.some(person => person.id === value)))) {
      throw new Error(`Source fact ${id} has an unknown participant.`)
    }
    return { id, text: claim.text, evidenceIds: [...claim.evidenceIds], audience }
  }))
}

export function restrictedFactsInPublicText(facts: readonly SourceFactAccess[], publicTexts: readonly { target: string; text: string }[]) {
  return publicTexts.flatMap(field => {
    const publicText = field.text.replace(/\s+/g, " ").toLocaleLowerCase()
    return facts.filter(fact => fact.audience.kind !== "public"
      && publicText.includes(fact.text.replace(/\s+/g, " ").trim().toLocaleLowerCase()))
      .map(fact => ({ factId: fact.id, target: field.target }))
  })
}
