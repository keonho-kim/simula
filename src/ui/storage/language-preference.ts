import type { LanguagePreference } from "@/ui/types/i18n"

const LANGUAGE_STORAGE_KEY = "simula.language"

export function readLanguagePreference(): LanguagePreference {
  if (typeof localStorage === "undefined") {
    return "system"
  }
  const value = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return value === "en" || value === "ko" || value === "system" ? value : "system"
}

export function writeLanguagePreference(preference: LanguagePreference): void {
  if (typeof localStorage === "undefined") {
    return
  }
  localStorage.setItem(LANGUAGE_STORAGE_KEY, preference)
}
