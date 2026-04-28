import type { ScenarioInput } from "@simula/shared"
import { normalizePromptLanguage } from "../language"
import { normalizeScenarioControls } from "../scenario"

export function normalizeStoredScenario(scenario: ScenarioInput): ScenarioInput {
  return {
    ...scenario,
    language: normalizePromptLanguage(scenario.language),
    controls: normalizeScenarioControls(scenario.controls),
  }
}

