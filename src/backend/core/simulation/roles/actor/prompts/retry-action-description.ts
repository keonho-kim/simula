/**
 * Purpose: Repair missing or copied solitary action descriptions without requesting speech.
 * Pattern: Pure prompt builder.
 * Usage: Selected by the actor text node for solitary output retries.
 * Related: src/backend/core/simulation/roles/actor/node.ts, src/backend/core/simulation/roles/actor/prompts/solitary-action.ts
 */
import { normalizePromptLanguage } from "@/backend/core/prompts/language"
import type { PromptLanguage } from "@/shared"
import type { ActorOutputIssue } from "./retry-message"

export function retryActionDescription(issue: ActorOutputIssue, language: PromptLanguage | undefined): string {
  const korean = normalizePromptLanguage(language) === "ko"
  const reason = issue.kind === "empty"
    ? korean ? "혼자 한 행동의 기록이 없습니다." : "The solitary action record is missing."
    : korean ? `생각이나 의도를 그대로 반복했습니다: ${issue.excerpt}` : `The record copied the thought or intent: ${issue.excerpt}`
  return `${reason}\n${korean
    ? "생각·의도·선택한 행동은 유지하고, 그 목적을 위해 혼자 실제로 한 행동 한 문장만 다시 쓰세요. 상대와 대사는 없습니다. 주어를 생략하고, 새로운 사실이나 성과를 만들지 마세요. None 대신 행동 기록을 반환하세요."
    : "Keep the thought, intent, and selected action. Rewrite only one concrete action taken alone for that purpose. There is no recipient and no dialogue. Omit the subject; invent no facts or achievements. Return an action description instead of None."}`
}
