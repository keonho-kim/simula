/**
 * Purpose: Ask for one concise grounded commentary summary.
 * Pattern: Prompt definition.
 * Usage: Used for the first field of a commentary node.
 * Related: src/backend/core/simulation/outputs/commentary/prompts/context.ts
 */
import type { PromptLanguage } from "@/shared"
import { commentaryContext, type CommentaryPromptTask } from "./context"

export function commentarySummary(task: CommentaryPromptTask, context: string, language: PromptLanguage | undefined, feedback: string): string {
  return `${commentaryContext(task, context, language, undefined, feedback)}
Field: summary
Return one complete, concise grounded summary in plain text. Do not return JSON, a list or evidence IDs.`
}
