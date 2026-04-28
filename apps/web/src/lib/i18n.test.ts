/// <reference types="bun" />

import { describe, expect, test } from "bun:test"
import { resolveLocale, resolvePromptLanguage } from "./i18n"

describe("i18n language resolution", () => {
  test("uses browser Korean locale when preference is system", () => {
    expect(resolvePromptLanguage("system", "ko-KR")).toBe("ko")
  })

  test("uses explicit language preference before browser locale", () => {
    expect(resolvePromptLanguage("en", "ko-KR")).toBe("en")
    expect(resolvePromptLanguage("ko", "en-US")).toBe("ko")
  })

  test("falls back to English for unsupported browser locales", () => {
    expect(resolveLocale("fr-FR")).toBe("en")
    expect(resolvePromptLanguage("system", undefined)).toBe("en")
  })
})
