import type { PromptLanguage } from "@simula/shared"
import type { dictionary } from "./dictionary"

export type Locale = "ko" | "en"
export type LanguagePreference = "system" | PromptLanguage
export type UiTexts = Record<keyof typeof dictionary.en, string>
