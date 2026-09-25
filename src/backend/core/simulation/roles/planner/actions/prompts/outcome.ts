/**
 * Purpose: Request one attempted effect for an accepted action and its condition.
 * Pattern: Prompt definition.
 * Usage: Called by the Planner action-catalog node after label and intent.
 * Related: src/backend/core/simulation/roles/planner/actions/node.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { ActionVisibility, PromptLanguage } from "@/shared"

export function actionOutcomePrompt(context: string, visibility: ActionVisibility, label: string,
  intentHint: string, language: PromptLanguage, errors: string[]): string {
  const instruction = language === "ko"
    ? "이 행동이 시도하는 효과를 한국어 한 문장으로만 작성하세요. 200자 이내이며 결과의 성공을 보장하지 마세요. JSON·코드·설명 문단은 쓰지 마세요."
    : "Write one English sentence describing the effect this action attempts. Stay within 200 characters and do not guarantee success. No JSON, code, or explanatory paragraph."
  return `Planner actionCatalog.\nField: expectedOutcome\nScope: ${visibility}\n${instruction}\n\n${renderPromptBlock("SCENARIO", context)}\n\n${renderPromptBlock("REVIEW_TARGET", { label, intentHint })}${errors.length ? `\n${renderPromptBlock("FEEDBACK", errors)}` : ""}`
}
