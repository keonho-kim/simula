import type { ScenarioInput } from "@/shared"
import { normalizePromptLanguage } from "@/backend/core/prompts/language"
import { normalizeScenarioControls } from "@/backend/core/scenario"

export function normalizeStoredScenario(scenario: ScenarioInput): ScenarioInput {
  return {
    ...scenario,
    language: normalizePromptLanguage(scenario.language),
    controls: normalizeScenarioControls(scenario.controls),
  }
}
