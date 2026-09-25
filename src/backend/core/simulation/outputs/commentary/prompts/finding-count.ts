/**
 * Purpose: Select a bounded number of commentary findings from supplied evidence.
 * Pattern: Finite-choice prompt.
 * Usage: Used after a commentary node accepts its summary.
 * Related: src/backend/core/simulation/outputs/commentary/prompts/context.ts
 */
import type { PromptLanguage } from "@/shared"
import { commentaryContext, type CommentaryPromptTask } from "./context"

export function commentaryFindingCount(task: CommentaryPromptTask, context: string, language: PromptLanguage | undefined,
  summary: string, feedback: string): string {
  return `${commentaryContext(task, context, language, { summary }, feedback)}
Field: finding-count
Choose how many distinct, supported findings this evidence needs: 1, 2, 3 or 4. Return one supplied number only.`
}
