import type { PromptLanguage } from "@/shared"
import type { dictionary } from "@/ui/i18n/dictionary"

export type Locale = "ko" | "en"
export type LanguagePreference = "system" | PromptLanguage
export type UiTexts = Record<keyof typeof dictionary.en, string>
