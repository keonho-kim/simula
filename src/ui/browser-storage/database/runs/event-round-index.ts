/**
 * Purpose: Project an event's round into the browser event index.
 * Pattern: Pure Function.
 * Usage: Called when stream or final run events are stored.
 * Related: src/ui/browser-storage/database/runs/append-events.ts, src/ui/browser-storage/database/runs/save-detail.ts
 */
import type { RunEvent } from "@/shared"

export function eventRoundIndex(event: RunEvent): number | null {
  if ("roundIndex" in event && typeof event.roundIndex === "number") return event.roundIndex
  if (event.type === "interaction.recorded") return event.interaction.roundIndex
  if (event.type === "event.injected") return event.event.roundIndex
  if (event.type === "graph.delta") return event.frame.layoutRoundIndex ?? null
  return null
}
