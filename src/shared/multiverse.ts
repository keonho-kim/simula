/**
 * Purpose: Define bounded batch identities, world progress, and execution controls.
 * Pattern: Serializable lifecycle contract.
 * Usage: Shared by batch runtime, persistence, API, and browser controls.
 * Related: src/shared/multiverse-schema.ts, src/shared/world-preparation.ts
 */
import type { WorldControls } from "./world-preparation"

export const MAX_BATCH_WORLDS = 50
export const DEFAULT_BATCH_WORLDS = 5
export const DEFAULT_BATCH_MINUTES = 60
export const MAX_BATCH_MINUTES = 1440
export const AUTOMATIC_ROUND_DELAY_MS = 5000
export const AUTOMATIC_ROUND_DELAY_COUNT = 3

export interface MultiverseRequest {
  scenarioId: string
  controls: WorldControls
  worldCount: number
  autoContinue: boolean
  maxDurationMinutes: number
}

export type BatchWorldCommand = { kind: "cancel" } | { kind: "continue"; roundIndex: number } | { kind: "automatic"; enabled: boolean }

export type BatchWorldStatus = "pending" | "preparing" | "running" | "waiting" | "completed" | "failed" | "canceled" | "interrupted"
export interface BatchWorld {
  id: string
  index: number
  status: BatchWorldStatus
  autoContinue: boolean
  runId?: string
  roundIndex?: number
  automaticStreak: number
  continueAt?: string
  issue?: string
}

export interface MultiverseRecord {
  id: string
  request: MultiverseRequest
  sourceScenarioVersion: number
  createdAt: string
  deadlineAt: string
  revision: number
  status: "running" | "completed" | "partial" | "canceled" | "interrupted"
  stopReason?: "user" | "deadline"
  worlds: BatchWorld[]
}
