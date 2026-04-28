import type { RunEvent } from "@simula/shared"
import type { RunStore } from "@simula/core"

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

export function streamEvents(store: RunStore, subscriptions: Subscriptions, runId: string): Response {
  const encoder = new TextEncoder()
  let send: ((event: RunEvent) => void) | undefined
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      send = (event: RunEvent) => controller.enqueue(encoder.encode(formatSse(event)))
      const existing = await store.readEvents(runId).catch(() => [])
      for (const event of existing) {
        send(event)
      }
      const set = subscriptions.get(runId) ?? new Set<(event: RunEvent) => void>()
      set.add(send)
      subscriptions.set(runId, set)
      controller.enqueue(encoder.encode(": connected\n\n"))
    },
    cancel() {
      const set = subscriptions.get(runId)
      if (!set || !send) {
        return
      }
      set.delete(send)
      if (set.size === 0) {
        subscriptions.delete(runId)
      }
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
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

function formatSse(event: RunEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

