/**
 * Purpose: Describe one browser-owned run detail across its relational records.
 * Pattern: Data contract.
 * Usage: Imported by run detail queries and browser API adapters.
 * Related: src/ui/browser-storage/database/runs/save-detail.ts, src/ui/browser-storage/database/runs/read-detail.ts
 */
import type { GraphTimelineFrame, RunEvent, RunManifest, SimulationState } from "@/shared"

export interface BrowserRunDetail {
  run: RunManifest
  state?: SimulationState
  timeline: GraphTimelineFrame[]
  events: RunEvent[]
}
