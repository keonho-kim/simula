/**
 * Purpose: Ask for the later visible words that explicitly close a selected memory record.
 * Pattern: Prompt definition.
 * Usage: Called after selecting a record to close.
 * Related: src/backend/core/simulation/actors/retain-memory.ts
 */
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"
import type { ActorMemoryRecord } from "@/shared/actor-memory"
import type { ActorVisibleContextEntry } from "@/shared"
import { MEMORY_QUOTE_CHARS } from "../memory-records"

export function memoryClosureQuote(entry: ActorVisibleContextEntry, record: ActorMemoryRecord, feedback: string): string {
  return `Recipient retained-memory closure.
Field: closure-quote
Return only the exact words in CURRENT_STATE.content that explicitly fulfill, withdraw, resolve or replace the selected active record. Copy 4-${MEMORY_QUOTE_CHARS} characters from the current entry, not from the earlier record. No JSON, list or explanation.
${renderPromptBlocks({ PREVIOUS_STATE: { kind: record.kind, quote: record.quote },
  CURRENT_STATE: { speaker: entry.sourceActorName ?? entry.sourceActorId, round: entry.roundIndex, content: entry.content },
  FEEDBACK: feedback || undefined })}`
}
