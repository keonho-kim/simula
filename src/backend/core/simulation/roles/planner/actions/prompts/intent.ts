/**
 * Purpose: Request one use condition for an accepted action name.
 * Pattern: Prompt definition.
 * Usage: Called by the Planner action-catalog node after its label is accepted.
 * Related: src/backend/core/simulation/roles/planner/actions/node.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { ActionVisibility, PromptLanguage } from "@/shared"

export function actionIntentPrompt(context: string, visibility: ActionVisibility, label: string,
  language: PromptLanguage, errors: string[]): string {
  const instruction = language === "ko"
    ? "이 행동을 언제 또는 왜 사용하는지 한국어 한 문장으로만 작성하세요. 200자 이내이며 행동 이름을 다시 쓰거나 JSON·코드를 반환하지 마세요. 실제 인물의 권한과 공개 범위를 지키세요."
    : "Write one English sentence stating when or why this action is used. Stay within 200 characters; do not repeat the name or return JSON/code. Respect actor authority and visibility."
  return `Planner actionCatalog.\nField: intentHint\nScope: ${visibility}\n${instruction}\n\n${renderPromptBlock("SCENARIO", context)}\n\n${renderPromptBlock("REVIEW_TARGET", { label })}${errors.length ? `\n${renderPromptBlock("FEEDBACK", errors)}` : ""}`
}
