/**
 * Purpose: Normalize stored scenario controls and validate optional prepared-world artifacts.
 * Pattern: Persistence boundary parser.
 * Usage: Called by RunStore before saving or returning scenario input.
 * Related: src/shared/world-story-schema.ts, src/backend/core/scenario/index.ts
 */
import type { ScenarioInput } from "@/shared"
import { worldStorySchema } from "@/shared/world-story-schema"
import { normalizePromptLanguage } from "@/backend/core/prompts/language"
import { normalizeScenarioControls } from "@/backend/core/scenario"

export function normalizeStoredScenario(scenario: ScenarioInput): ScenarioInput {
  return {
    ...scenario,
    ...(scenario.world ? { world: worldStorySchema.parse(scenario.world) } : {}),
    language: normalizePromptLanguage(scenario.language),
    controls: normalizeScenarioControls(scenario.controls),
  }
}
