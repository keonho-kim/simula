import type { LLMSettings, ModelRole, PromptLanguage, RoleSettings } from "@simula/shared"
import { resolveRoleSettings } from "./settings"

export function normalizePromptLanguage(language: unknown): PromptLanguage {
  return language === "ko" ? "ko" : "en"
}

export function renderPromptLanguageGuide(language: unknown): string {
  const normalized = normalizePromptLanguage(language)
  const outputLanguage = normalized === "ko" ? "Korean" : "English"
  return `Language: ${outputLanguage}. Keep actor ids, action ids, enum values, and allowed outputs unchanged.`
}

export function withPromptLanguageGuide(prompt: string, language: unknown): string {
  return `${renderPromptLanguageGuide(language)}

${prompt}`
}

export function renderPromptReasoningGuide(reasoningEffort: RoleSettings["reasoningEffort"]): string {
  if (!reasoningEffort) {
    return ""
  }
  const limit =
    reasoningEffort === "low"
      ? "within 5 short sentences"
      : reasoningEffort === "medium"
        ? "within 10 short sentences"
        : "within 3 compact paragraphs"
  return `If you use a thinking phase, keep it ${limit}. Do not include reasoning in the final answer unless the prompt explicitly asks for it.`
}

export function withRolePromptGuide(
  prompt: string,
  input: {
    language: unknown
    settings: LLMSettings
    role: ModelRole
  }
): string {
  const languageGuide = renderPromptLanguageGuide(input.language)
  const reasoningGuide = renderPromptReasoningGuide(resolveRoleSettings(input.settings, input.role).reasoningEffort)
  return [languageGuide, reasoningGuide, prompt].filter(Boolean).join("\n\n")
}
