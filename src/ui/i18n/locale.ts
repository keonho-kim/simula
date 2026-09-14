import type { PromptLanguage } from "@/shared"
import type { LanguagePreference, Locale } from "@/ui/types/i18n"

export function resolveLocale(language?: string): Locale {
  return (language ?? "").toLowerCase().startsWith("ko") ? "ko" : "en"
}

export function resolvePromptLanguage(
  preference: LanguagePreference,
  browserLanguage?: string
): PromptLanguage {
  return preference === "system" ? resolveLocale(browserLanguage) : preference
}
