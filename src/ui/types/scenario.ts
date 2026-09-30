/**
 * Purpose: Describe editable scenario previews and their local launch options.
 * Pattern: Browser form contract.
 * Usage: Consumed by HomeView and scenario preview.
 * Related: src/ui/models/scenario-builder/launch-options.ts
 */
import type { ScenarioControls } from "@/shared"

import type { MultiverseOptions } from "@/ui/models/scenario-builder/launch-options"

export interface ScenarioDraft {
  multiverse?: MultiverseOptions
  sourceName: string
  text: string
  controls: ScenarioControls
}
