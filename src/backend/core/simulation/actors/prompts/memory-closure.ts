/**
 * Purpose: Select one active record explicitly closed by the current visible entry.
 * Pattern: Finite-choice prompt.
 * Usage: Called during individual or reader-specific memory closure.
 * Related: src/backend/core/simulation/actors/retain-memory.ts
 */
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"
import type { ActorMemoryRecord } from "@/shared/actor-memory"
import type { ActorVisibleContextEntry } from "@/shared"

export function memoryClosure(entry: ActorVisibleContextEntry, records: readonly ActorMemoryRecord[],
  closedIds: string[], feedback: string): string {
  return `Recipient retained-memory closure.
Field: closure-record
Choose one supplied record index explicitly fulfilled, withdrawn, resolved or replaced by CURRENT_STATE, or 0 if none remains. Silence, repetition, a future intention or a missing mention never closes a record. A decision, authority or constraint requires explicit reversal or replacement. Return one index only; no JSON or explanation.
${renderPromptBlocks({ OPTIONS: records.map((record, index) => ({ index: index + 1, kind: record.kind, quote: record.quote })),
  CURRENT_STATE: { speaker: entry.sourceActorName ?? entry.sourceActorId, round: entry.roundIndex, content: entry.content },
  PREVIOUS_RESULT: closedIds.length ? { closedIds } : undefined, FEEDBACK: feedback || undefined })}`
}
