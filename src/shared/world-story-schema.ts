/**
 * Purpose: Validate bounded world initial-state artifacts and participant identity uniqueness.
 * Pattern: Shared artifact schema.
 * Usage: Used by world construction, storage, and prepared simulation input parsing.
 * Related: src/shared/world-story.ts, src/shared/scenario-builder-schema.ts
 */
import { z } from "zod"
import { knownSourceFactSchema, storedParticipantSchema } from "./scenario-builder-schema"

const sentence = z.string().trim().min(1).max(500)
const statements = z.array(sentence).max(12)
export const MAX_WORLD_UNIT_REFERENCES = 12
export const worldOpeningSchema = z.object({ setting: sentence, summary: sentence, assumptions: statements, evidenceIds: z.array(z.string().max(160)).max(MAX_WORLD_UNIT_REFERENCES) }).strict()
export const worldActorOutputSchema = z.object({ summary: sentence, assumptions: z.array(sentence).max(4), evidenceIds: z.array(z.string().max(160)).max(MAX_WORLD_UNIT_REFERENCES) }).strict()
export const worldConcernSchema = z.object({ goal: sentence, evidenceIds: z.array(z.string().max(160)).max(MAX_WORLD_UNIT_REFERENCES) }).strict()
const participant = storedParticipantSchema.extend({ initialPosition: sentence, privateConcern: sentence, startingAssumptions: z.array(sentence).max(4),
  knownSourceFacts: z.array(knownSourceFactSchema).max(4) })
export const worldStorySchema = z.object({
  id: z.uuid(), sourceScenarioId: z.uuid(), sourceScenarioVersion: z.number().int().positive(),
  documentSetId: z.uuid(), documentRevision: z.number().int().nonnegative(),
  opening: worldOpeningSchema, participants: z.array(participant).min(1).max(12),
  agenda: statements.min(1), informationFlow: statements.min(1), constraints: statements,
  actionScope: statements.min(1), endConditions: statements.min(1), allowedVariation: statements,
  assumptions: z.array(sentence).max(100),
}).strict().refine(value => new Set(value.participants.map(person => person.id)).size === value.participants.length, "World participant IDs must be unique.")
