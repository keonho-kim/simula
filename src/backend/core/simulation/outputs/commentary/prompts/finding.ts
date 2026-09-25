/**
 * Purpose: Ask for one distinct evidence-grounded commentary finding.
 * Pattern: Prompt definition.
 * Usage: Used once per selected finding in a commentary node.
 * Related: src/backend/core/simulation/outputs/commentary/prompts/context.ts
 */
import type { PromptLanguage } from "@/shared"
import { commentaryContext, type CommentaryPromptTask } from "./context"

export function commentaryFinding(task: CommentaryPromptTask, context: string, language: PromptLanguage | undefined,
  summary: string, findings: string[], feedback: string): string {
  return `${commentaryContext(task, context, language, { summary, acceptedFindings: findings }, feedback)}
Field: finding-${findings.length + 1}
Return one distinct, concrete finding grounded in the supplied record. Do not repeat an accepted finding or return JSON, a list or evidence IDs.`
}
