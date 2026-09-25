/**
 * Purpose: Request a spoken-line correction for empty or copied actor speech.
 * Pattern: Pure prompt builder.
 * Usage: Called after the actor node validates speech against private fields.
 * Related: src/backend/core/simulation/roles/actor/node.ts
 */
import { normalizePromptLanguage } from "@/backend/core/prompts/language"
import type { PromptLanguage } from "@/shared"

type SpeechIssue = { kind: "empty" } | { kind: "copied"; source: "thought" | "intent"; excerpt: string }

export function retryMessage(issue: SpeechIssue, language: PromptLanguage | undefined): string {
  const korean = normalizePromptLanguage(language) === "ko"
  if (issue.kind === "empty") {
    return korean ? "발화가 비어 있습니다. 실제 대사 하나 또는 침묵을 뜻하는 None을 반환하세요." : "Speech was empty. Return one spoken line or None for silence."
  }
  return korean
    ? `직전 발화가 ${issue.source === "thought" ? "생각" : "의도"} 문장을 그대로 복사했습니다: ${issue.excerpt}\n생각·의도·행동·대상은 유지하고 발화만 다시 작성하세요. 내적 설명 대신 상대에게 실제로 하는 요청·질문·답변으로 표현하세요. 의미를 바꾸거나 숨은 동기를 만들 필요는 없습니다. 실제로 말하지 않는 경우에만 None을 사용하세요.`
    : `The previous speech copied ${issue.source}: ${issue.excerpt}\nKeep thought, intent, action and target unchanged; rewrite only the spoken line as a request, question or reply to the recipient, not an internal explanation. Keep the meaning; do not invent hidden motives. Use None only if genuinely not speaking.`
}
