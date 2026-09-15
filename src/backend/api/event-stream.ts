import type { RunEvent } from "@/shared"
import type { RunStore } from "@/backend/storage/runs/run-store"

import type { Subscriptions } from "@/backend/runtime/events"

interface StreamEventsOptions {
  onSubscribe?: (runId: string) => void
  onEmpty?: (runId: string) => void
}

export function streamEvents(
  store: RunStore,
  subscriptions: Subscriptions,
  runId: string,
  options: StreamEventsOptions = {}
): Response {
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
      options.onSubscribe?.(runId)
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
        options.onEmpty?.(runId)
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

function formatSse(event: RunEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

export function streamBoardPreview(subscriptions: Subscriptions, runId: string, itemId: string): Response {
  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | undefined
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      unsubscribe = subscriptions.previews.subscribe(runId, itemId, event => controller.enqueue(encoder.encode(formatSse(event))))
      controller.enqueue(encoder.encode(": connected\n\n"))
    },
    cancel() { unsubscribe?.() },
  }), { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } })
}
