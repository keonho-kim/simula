/**
 * Purpose: Publish only owner-accepted simulation events and scoped provisional board previews.
 * Pattern: Persistence and subscription coordinator.
 * Usage: Simulation and legacy commentary execution supply their run lease.
 * Related: src/backend/storage/runs/run-store.ts, src/backend/runtime/execute-run.ts
 */
import type { ExecutionLease } from "@/backend/storage/generation/execution-lease"
import { BoardPreviews } from "./board-previews"
import type { RunEvent } from "@/shared"
import type { RunStore } from "@/backend/storage/runs/run-store"

export class Subscriptions extends Map<string, Set<(event: RunEvent) => void>> {
  readonly previews = new BoardPreviews()
}

export async function appendAndPublish(
  store: RunStore,
  subscriptions: Subscriptions,
  event: RunEvent,
  lease: ExecutionLease
): Promise<void> {
  if (event.type === "board.updated" && event.update.kind === "preview") {
    lease.assertActive(); subscriptions.previews.publish(event); return
  }
  const frame = await store.appendEvent(event, lease)
  subscriptions.previews.publish(event)
  publish(subscriptions, event.runId, event)
  if (frame && event.type !== "graph.delta") {
    const graphEvent: RunEvent = {
      type: "graph.delta",
      runId: event.runId,
      timestamp: frame.timestamp,
      frame,
    }
    await store.appendEvent(graphEvent, lease)
    publish(subscriptions, event.runId, graphEvent)
  }
}

function publish(subscriptions: Subscriptions, runId: string, event: RunEvent): void {
  const set = subscriptions.get(runId)
  if (!set) {
    return
  }
  for (const subscriber of set) {
    subscriber(event)
  }
}
