import type { PromptLanguage } from "@simula/shared"

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
