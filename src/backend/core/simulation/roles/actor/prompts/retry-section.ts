/**
 * Purpose: Instruct an actor to retry a response that mixes decision stages.
 * Pattern: Pure prompt builder.
 * Usage: Called after the actor node detects mixed response labels.
 * Related: src/backend/core/simulation/roles/actor/node.ts
 */
import { normalizePromptLanguage } from "@/backend/core/prompts/language"
import type { PromptLanguage } from "@/shared"

export function retrySection(language: PromptLanguage | undefined): string {
  return normalizePromptLanguage(language) === "ko"
    ? "현재 단계의 내용만 출력하세요. 생각·의도·발화를 한 응답에 합치거나 다른 단계의 제목을 쓰지 마세요."
    : "Output only the current step. Do not combine thought, intent, and speech or include another step's label."
}
