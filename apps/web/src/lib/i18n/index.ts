import { useCallback, useEffect, useMemo, useState } from "react"
import type { PromptLanguage } from "@simula/shared"
import { dictionary } from "./dictionary"
import type { LanguagePreference, Locale, UiTexts } from "./types"

export type { LanguagePreference, Locale, UiTexts }
export { dictionary }

export const LANGUAGE_STORAGE_KEY = "simula.language"

export function resolveLocale(language?: string): Locale {
  return (language ?? "").toLowerCase().startsWith("ko") ? "ko" : "en"
}

export function resolvePromptLanguage(
  preference: LanguagePreference,
  browserLanguage?: string
): PromptLanguage {
  return preference === "system" ? resolveLocale(browserLanguage) : preference
}

export function useLocaleText() {
  const [languagePreference, setLanguagePreferenceState] = useState<LanguagePreference>(() =>
    readLanguagePreference()
  )
  const [browserLanguage, setBrowserLanguage] = useState(() =>
    typeof navigator === "undefined" ? undefined : navigator.language
  )

  useEffect(() => {
    setBrowserLanguage(typeof navigator === "undefined" ? undefined : navigator.language)
  }, [])

  const promptLanguage = resolvePromptLanguage(languagePreference, browserLanguage)
  const locale = promptLanguage
  const setLanguagePreference = useCallback((preference: LanguagePreference) => {
    setLanguagePreferenceState(preference)
    writeLanguagePreference(preference)
  }, [])

  return useMemo(
    () => ({
      locale,
      promptLanguage,
      languagePreference,
      setLanguagePreference,
      t: dictionary[locale] as UiTexts,
    }),
    [languagePreference, locale, promptLanguage, setLanguagePreference]
  )
}

function readLanguagePreference(): LanguagePreference {
  if (typeof localStorage === "undefined") {
    return "system"
  }
  const value = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return value === "en" || value === "ko" || value === "system" ? value : "system"
}

function writeLanguagePreference(preference: LanguagePreference): void {
  if (typeof localStorage === "undefined") {
    return
  }
  localStorage.setItem(LANGUAGE_STORAGE_KEY, preference)
}
