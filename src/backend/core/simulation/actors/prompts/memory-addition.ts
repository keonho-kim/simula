/**
 * Purpose: Ask for one exact visible quote worth retaining, or zero when none remains.
 * Pattern: Prompt definition.
 * Usage: Called during individual and shared retained-memory ingestion.
 * Related: src/backend/core/simulation/actors/retain-memory.ts
 */
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"
import type { ActorMemoryRecord } from "@/shared/actor-memory"
import type { ActorVisibleContextEntry } from "@/shared"
import { MEMORY_QUOTE_CHARS } from "../memory-records"

export function memoryAddition(entry: ActorVisibleContextEntry, records: readonly ActorMemoryRecord[],
  acceptedQuotes: string[], shared: boolean, feedback: string): string {
  return `${shared ? "Shared accepted memory extraction." : "Actor retained memory."}
Field: addition-quote
Return only one exact substring of CURRENT_STATE.content, 4-${MEMORY_QUOTE_CHARS} characters, worth retaining beyond this turn. If no further distinct addition exists, return only 0. No JSON, list or explanation.
Retain explicit commitments, decisions, authority changes, active constraints and unresolved questions. These are records of statements, not proof of truth. Do not turn questions into decisions, proposals into agreements or private intentions into promises. Never infer hidden motives.
Completed incidental actions, routine acknowledgments and audio/video checks are not new active memories. Do not repeat an accepted quote or an unchanged active record. Preserve names, dates, conditions and negation in the source language.
${renderPromptBlocks({ PREVIOUS_STATE: shared ? undefined : records.map(record => ({ id: record.id, kind: record.kind, quote: record.quote })),
  CURRENT_STATE: { entryId: entry.id, speaker: entry.sourceActorName ?? entry.sourceActorId, round: entry.roundIndex, content: entry.content },
  PREVIOUS_RESULT: acceptedQuotes.length ? { acceptedQuotes } : undefined, FEEDBACK: feedback || undefined })}`
}
