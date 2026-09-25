/**
 * Purpose: Ask for the final conclusion of one commentary frontier node.
 * Pattern: Prompt definition.
 * Usage: Used after summary and findings are accepted.
 * Related: src/backend/core/simulation/outputs/commentary/prompts/context.ts
 */
import type { PromptLanguage } from "@/shared"
import { commentaryContext, type CommentaryPromptTask } from "./context"
import { detailedConclusionInstruction } from "./detailed-conclusion"
import { evidenceItemInstruction } from "./evidence-item"
import { overallConclusionInstruction } from "./overall-conclusion"

export function commentaryConclusion(task: CommentaryPromptTask, context: string, language: PromptLanguage | undefined,
  summary: string, findings: string[], overall: boolean, feedback: string): string {
  const instruction = task.level === 0 ? evidenceItemInstruction
    : overall ? overallConclusionInstruction : detailedConclusionInstruction
  return `${commentaryContext(task, context, language, { summary, findings }, feedback)}
Field: conclusion
${instruction}
Return one complete explanatory paragraph in plain text. Distinguish uncertainty; do not return JSON, a list or evidence IDs.`
}
