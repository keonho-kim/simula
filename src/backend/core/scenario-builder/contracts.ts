/**
 * Purpose: Normalize shared scenario input and define its narrow evidence dependency.
 * Pattern: Domain boundary parser.
 * Usage: Called by scenario generation tasks and HTTP request handling.
 * Related: src/shared/scenario-builder-schema.ts, src/backend/core/generation/tasks.ts
 */
import type { EvidenceBlock } from "@/shared/documents"
import type { GenerationDependencies, GenerationTasks } from "@/backend/core/generation/tasks"
import type { BuilderRequest } from "@/shared/scenario-builder"
import { participantNameKey, requestSchema } from "@/shared/scenario-builder-schema"

export function parseBuilderRequest(value: unknown): BuilderRequest {
  const parsed = requestSchema.parse(value)
  const participants = parsed.participants.filter(value => value.name || value.personality)
  if (participants.some(value => !value.name)) throw new Error("A participant personality requires a name or role title.")
  const names = participants.map(value => participantNameKey(value.name))
  if (new Set(names).size !== names.length) throw new Error("Participant names must be distinct.")
  return { ...parsed, participants: participants.map(value => value.personality ? value : { name: value.name }) }
}

export interface BuilderDependencies extends GenerationDependencies {
  readEvidence: (documentId: string) => Promise<EvidenceBlock[]>
}
export type BuilderTasks = GenerationTasks<BuilderRequest>
