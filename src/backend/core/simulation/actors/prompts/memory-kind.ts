/**
 * Purpose: Classify one accepted memory quote by a supplied record kind.
 * Pattern: Finite-choice prompt.
 * Usage: Called after a memory addition quote is accepted.
 * Related: src/backend/core/simulation/actors/retain-memory.ts
 */
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"
import type { ActorVisibleContextEntry } from "@/shared"

export function memoryKind(entry: ActorVisibleContextEntry, quote: string, feedback: string): string {
  return `Actor retained memory.
Field: addition-kind
Classify the exact visible quote as one of: commitment, decision, authority, constraint, unresolved. Return only one supplied word; no JSON or explanation. A proposal is not an agreed decision.
${renderPromptBlocks({ CURRENT_STATE: { speaker: entry.sourceActorName ?? entry.sourceActorId, content: entry.content },
  PREVIOUS_RESULT: { quote }, FEEDBACK: feedback || undefined })}`
}
