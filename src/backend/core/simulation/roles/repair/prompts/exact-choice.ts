/**
 * Purpose: Correct one rejected finite choice.
 * Pattern: Simple Module.
 * Usage: Imported by the owning workflow.
 * Related: src/backend/core/simulation/roles/repair.ts
 */
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"
import type { ActorTraceStep, CoordinatorTraceStep } from "@/shared"

export function buildRepairChoicePrompt(input: { sourceRole: "actor" | "coordinator"; sourceStep: ActorTraceStep | CoordinatorTraceStep; sourceId?: string; invalidText: string; allowedOutputs: string[] }): string {
  return `Repair ${input.sourceRole}.${input.sourceStep}.
Return exactly one allowed output from the list.
No explanation, markdown, punctuation, or translation.

${renderPromptBlocks({ INFO: { role: input.sourceRole, step: input.sourceStep, id: input.sourceId },
  REVIEW_TARGET: input.invalidText, OPTIONS: `Allowed outputs:\n${input.allowedOutputs.map(output => `- ${output}`).join("\n")}` })}`
}
