import type { RunEvent } from "@/shared"
import type { RunStore } from "@/backend/storage/runs/run-store"

export type Subscriptions = Map<string, Set<(event: RunEvent) => void>>

export async function appendAndPublish(
  store: RunStore,
  subscriptions: Subscriptions,
  event: RunEvent
): Promise<void> {
  const frame = await store.appendEvent(event)
  publish(subscriptions, event.runId, event)
  if (frame && event.type !== "graph.delta") {
    const graphEvent: RunEvent = {
      type: "graph.delta",
      runId: event.runId,
      timestamp: frame.timestamp,
      frame,
    }
    await store.appendEvent(graphEvent)
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
