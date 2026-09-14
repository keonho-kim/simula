import { useCallback, useEffect, useMemo, useState } from "react"
import { dictionary } from "@/ui/i18n/dictionary"
import { resolvePromptLanguage } from "@/ui/i18n/locale"
import { readLanguagePreference, writeLanguagePreference } from "@/ui/storage/language-preference"
import type { LanguagePreference, UiTexts } from "@/ui/types/i18n"

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
