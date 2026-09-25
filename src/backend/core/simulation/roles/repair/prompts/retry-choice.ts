/**
 * Purpose: Build correction feedback for rejected finite choices.
 * Pattern: Simple Module.
 * Usage: Imported by the owning workflow.
 * Related: src/backend/core/simulation/roles/actor/node.ts, src/backend/core/simulation/roles/coordinator/invocation.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"

export function retryChoice(invalidResponses: readonly string[], allowedOutputs: readonly string[]): string {
  if (!invalidResponses.length) return ""
  return `\n\n${renderPromptBlock("FEEDBACK", { invalidResponses, allowedOutputs })}\nReturn one exact allowed output only.`
}
