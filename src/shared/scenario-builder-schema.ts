/**
 * Purpose: Define serializable scenario request and artifact validation contracts.
 * Pattern: Shared boundary schemas.
 * Usage: Used by backend generation/storage and browser API response parsing.
 * Related: src/shared/scenario-builder.ts, src/backend/core/scenario-builder/contracts.ts
 */
import { z } from "zod"
import { SITUATION_PRESETS } from "./scenario-builder"

const short = z.string().trim().min(1).max(300)
const statement = z.string().trim().min(1).max(500)
const refs = z.array(z.string().min(1).max(160)).max(12)
const assumptions = z.array(statement).max(4)
const MAX_SOURCE_FACTS = 4
const DIGEST_MAX_CHARS = 3_000
const FACET_MAX_CHARS = 1_800
const SITUATION_MAX_CHARS = 3_000
const participantInput = z.object({ name: z.string().trim().max(80), personality: z.string().trim().max(500).optional() }).strict()
export const requestSchema = z.object({
  documentSetId: z.uuid(), documentRevision: z.number().int().nonnegative(),
  context: z.string().trim().max(1600).default(""), situation: z.enum(SITUATION_PRESETS).default("auto"),
  language: z.enum(["en", "ko"]).default("ko"), fastMode: z.boolean().default(false),
  participants: z.array(participantInput).max(12).default([]),
}).strict()

export const digestSchema = z.object({
  summary: short,
  claims: z.array(z.object({ text: short, evidenceIds: refs.min(1) }).strict()).max(MAX_SOURCE_FACTS),
  gaps: z.array(short).max(4),
}).strict().refine(value => JSON.stringify(value).length <= DIGEST_MAX_CHARS, "Keep the complete evidence summary within 3000 characters; use fewer claims and citations.")
export const facetSchema = z.object({ summary: statement, assumptions, evidenceIds: refs }).strict()
  .refine(value => JSON.stringify(value).length <= FACET_MAX_CHARS, "Keep the complete facet within 1800 characters.")
export const situationSchema = z.object({ title: z.string().trim().min(1).max(160), purpose: short, decision: short, setting: short, assumptions, evidenceIds: refs }).strict()
  .refine(value => JSON.stringify(value).length <= SITUATION_MAX_CHARS, "Keep the complete situation within 3000 characters.")
export const participantSchema = z.object({ personality: statement, authority: short, goal: short, evidenceIds: refs }).strict()
export const storedParticipantSchema = participantSchema.extend({
  id: z.string().min(1), name: z.string().min(1).max(80), nameLocked: z.boolean(), personalityLocked: z.boolean(),
})
export function participantNameKey(name: string): string { return name.normalize("NFKC").toLocaleLowerCase("en") }
export const rosterSchema = z.object({ names: z.array(z.string().trim().min(1).max(80)).min(2).max(6) }).strict()
  .refine(value => new Set(value.names.map(participantNameKey)).size === value.names.length, "Participant names must be distinct.")
export const rulesSchema = z.object({ entries: z.array(short).min(1).max(4), assumptions, evidenceIds: refs }).strict()
export const sourceFactAudienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("public") }).strict(),
  z.object({ kind: z.literal("participants"), participantIds: z.array(z.string().min(1)).min(1).max(12) }).strict(),
  z.object({ kind: z.literal("unresolved") }).strict(),
])
const sourceFactSchema = z.object({ id: z.string().regex(/^fact-[1-9]\d*$/), text: short,
  evidenceIds: refs.min(1), audience: sourceFactAudienceSchema }).strict()
export const knownSourceFactSchema = sourceFactSchema.omit({ audience: true })
const issueSchema = z.object({ scope: short, description: statement, blocking: z.boolean() }).strict()
export const checksSchema = z.object({ issues: z.array(issueSchema).max(6) }).strict()

export const specificationSchema = z.object({
  id: z.uuid(), version: z.number().int().positive(), status: z.enum(["review", "blocked", "confirmed"]),
  documentSetId: z.uuid(), documentRevision: z.number().int().nonnegative(), language: z.enum(["en", "ko"]),
  situation: situationSchema,
  facets: z.object({ goals: facetSchema, constraints: facetSchema, tensions: facetSchema }).strict(),
  participants: z.array(storedParticipantSchema).min(1).max(12),
  rules: z.object({ information: rulesSchema, actions: rulesSchema, termination: rulesSchema, variation: rulesSchema }).strict(),
  sourceFacts: z.array(sourceFactSchema).max(MAX_SOURCE_FACTS),
  sourceEvidenceIds: z.array(z.string().min(1).max(160)).max(200),
  issues: z.array(issueSchema).max(100),
}).strict().superRefine((value, context) => {
  const participantIds = new Set(value.participants.map(participant => participant.id))
  const evidenceIds = new Set(value.sourceEvidenceIds)
  for (const [index, fact] of value.sourceFacts.entries()) {
    if (fact.id !== `fact-${index + 1}`) context.addIssue({ code: "custom", path: ["sourceFacts", index, "id"], message: "Source fact IDs must follow their accepted order." })
    if (fact.evidenceIds.some(id => !evidenceIds.has(id))) context.addIssue({ code: "custom", path: ["sourceFacts", index, "evidenceIds"], message: "Source fact citations must belong to this scenario." })
    if (fact.audience.kind === "participants" && (new Set(fact.audience.participantIds).size !== fact.audience.participantIds.length
      || fact.audience.participantIds.some(id => !participantIds.has(id)))) {
      context.addIssue({ code: "custom", path: ["sourceFacts", index, "audience"], message: "Source fact recipients must be distinct confirmed participants." })
    }
    if (value.status === "confirmed" && fact.audience.kind === "unresolved") {
      context.addIssue({ code: "custom", path: ["sourceFacts", index, "audience"], message: "Resolve source fact access before confirmation." })
    }
  }
})

export const buildRecordSchema = z.object({
  id: z.uuid(), request: requestSchema, status: z.enum(["running", "review", "blocked", "confirmed", "failed", "canceled"]),
  usageAccountingVersion: z.literal(1).optional(),
  createdAt: z.iso.datetime(), issue: z.string().max(1000).optional(), specification: specificationSchema.optional(),
}).strict()
