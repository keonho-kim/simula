/**
 * Purpose: Verify configured output language covers prose and shared generation without translating machine choices.
 * Pattern: Prompt contract tests.
 * Usage: Executed by bun test.
 * Related: src/backend/core/prompts/language.ts, src/backend/core/generation/prompts/plain-task.ts
 */
import { expect, test } from "bun:test"
import { withRolePromptGuide, withPromptLanguageGuide } from "./language"
import { defaultSettings } from "../settings/defaults"
import { plainTaskPrompt } from "../generation/prompts/plain-task"
import { pagePrompt } from "@/backend/integrations/documents/prompts/page-interpretation"

for (const language of ["ko", "en"] as const) test(`all prompt families use the selected language (${language})`, () => {
  const prose = withRolePromptGuide("Describe the result.", { language, settings: defaultSettings(), role: "actor" })
  const choice = withPromptLanguageGuide("Return None, 0, or 1.", language)
  const generated = plainTaskPrompt({ id: "report", language, instruction: "Explain", shape: "one paragraph", packet: "English source", mode: "text", feedback: "" })
  const vision = pagePrompt("document", 1, "English source", false, language)
  for (const prompt of [prose, choice, generated, vision]) {
    expect(prompt).toContain(`Output language setting: ${language}`)
    expect(prompt).toContain("enum values, and allowed outputs unchanged")
    expect(prompt).toContain(language === "ko" ? "한국어로 작성" : "Write English prose.")
    expect(prompt).not.toContain("points in the source language")
  }
  expect(choice).toContain("Return None, 0, or 1.")
  expect(vision).toContain("English source")
})
