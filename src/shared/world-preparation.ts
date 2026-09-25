/**
 * Purpose: Define per-world preparation controls and persisted job state.
 * Pattern: Shared lifecycle contract.
 * Usage: Used by world API, runtime, storage, and launch UI.
 * Related: src/shared/world-story.ts, src/shared/world-preparation-schema.ts
 */
import type { ScenarioControls } from "./scenario"
import type { WorldStory } from "./world-story"

export type WorldControls = Pick<ScenarioControls, "actionsPerType" | "maxRound" | "fastMode" | "autonomousProgress" | "outputLength">
export interface WorldPreparationRequest { scenarioId: string; controls: WorldControls }
export interface WorldPreparationRecord {
  id: string
  request: WorldPreparationRequest
  usageAccountingVersion?: 1
  sourceScenarioVersion: number
  createdAt: string
  batchId?: string
  status: "preparing" | "ready" | "failed" | "canceled"
  issue?: string
  story?: WorldStory
  runId?: string
}
