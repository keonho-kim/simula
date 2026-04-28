import type { PromptLanguage } from "@simula/shared"

export function normalizePromptLanguage(language: unknown): PromptLanguage {
  return language === "ko" ? "ko" : "en"
}

export function renderPromptLanguageGuide(language: unknown): string {
  const normalized = normalizePromptLanguage(language)
  const outputLanguage = normalized === "ko" ? "Korean" : "English"
  return `Language guide: Write every natural-language response for this request in ${outputLanguage}.
Keep actor ids, action ids, enum values, and other machine-readable tokens exactly as specified.`
}

export function withPromptLanguageGuide(prompt: string, language: unknown): string {
  return `${renderPromptLanguageGuide(language)}

${prompt}`
}
