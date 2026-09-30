/**
 * Purpose: Own persisted setup choices and project scenario controls into world launch controls.
 * Pattern: Simple Module.
 * Usage: Shared by scenario previews, document setup, and world launch.
 * Related: src/shared/multiverse.ts, src/ui/types/scenario.ts
 */
import { DEFAULT_BATCH_WORLDS, MAX_BATCH_WORLDS } from "@/shared/multiverse"
import type { WorldControls } from "@/shared/world-preparation"
import type { ScenarioControls } from "@/shared/scenario"
import type { BuilderRequest } from "@/shared/scenario-builder"

export interface MultiverseOptions { enabled: boolean; worldCount: number }
export interface ScenarioLaunchOptions { multiverse?: MultiverseOptions; controls?: WorldControls }
export type ScenarioBuilderForm = Pick<BuilderRequest, "context" | "situation" | "fastMode" | "participants"> & ScenarioLaunchOptions
export const DEFAULT_MULTIVERSE: Readonly<MultiverseOptions> = { enabled: false, worldCount: DEFAULT_BATCH_WORLDS }
export function validMultiverse(options?: MultiverseOptions): boolean {
  return !options?.enabled || (Number.isInteger(options.worldCount) && options.worldCount >= 1 && options.worldCount <= MAX_BATCH_WORLDS)
}
export function worldControlsFromScenario(controls: ScenarioControls): WorldControls {
  const { actionsPerType, maxRound, fastMode, autonomousProgress, outputLength } = controls
  return { actionsPerType, maxRound, fastMode, autonomousProgress, outputLength }
}
export function builderRequestFields(form: ScenarioBuilderForm): Pick<BuilderRequest, "context" | "situation" | "fastMode" | "participants"> {
  const { context, situation, fastMode, participants } = form
  return { context, situation, fastMode, participants }
}
