/**
 * Purpose: Stream persisted run events and selected board previews without controlling execution.
 * Pattern: Subscription transport adapter.
 * Usage: Called by run event and board-preview API routes.
 * Related: src/backend/runtime/events.ts, src/backend/api/routes.ts
 */
import { RUN_STREAM_END, RUN_STREAM_ERROR, RunStreamCursorError } from "@/shared/run-stream"
import { json } from "../responses"
import type { RunEvent } from "@/shared"
import type { RunStore } from "@/backend/storage/runs/run-store"

import type { Subscriptions } from "@/backend/runtime/events"

const REMOTE_LOG_POLL_MS = 500
const HEARTBEAT_MS = 15_000
const STREAM_BUFFER_BYTES = 64 * 1024

export async function streamEvents(
  store: RunStore, subscriptions: Subscriptions, runId: string, cursor?: string, signal?: AbortSignal
): Promise<Response> {
  let log
  try { log = await store.openEventLog(runId, cursor) }
  catch (error) {
    if (error instanceof RunStreamCursorError) return json({ error: error.message }, { status: 400 })
    return json({ error: "Stored run events are unavailable." }, { status: 404 })
  }
  const encoder = new TextEncoder()
  let closed = false
  let revision = 0
  let wake: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastHeartbeat = Date.now()
  let abort: (() => void) | undefined
  const notify = () => { revision++; wake?.() }
  const dispose = async () => {
    if (closed) return
    closed = true
    clearTimeout(timer)
    wake?.()
    subscriptions.get(runId)?.delete(notify)
    if (!subscriptions.get(runId)?.size) subscriptions.delete(runId)
    if (abort) signal?.removeEventListener("abort", abort)
    await log.close()
  }
  const waitForAppend = (observed: number) => new Promise<void>(resolve => {
    if (closed || observed !== revision) { resolve(); return }
    wake = () => { clearTimeout(timer); wake = undefined; resolve() }
    timer = setTimeout(() => wake?.(), REMOTE_LOG_POLL_MS)
  })
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      abort = () => { void dispose(); controller.close() }
      if (signal?.aborted) { abort(); return }
      signal?.addEventListener("abort", abort, { once: true })
      const set = subscriptions.get(runId) ?? new Set<(event: RunEvent) => void>()
      set.add(notify)
      subscriptions.set(runId, set)
      controller.enqueue(encoder.encode(": connected\nretry: 1000\n\n"))
    },
    async pull(controller) {
      try {
        while (!closed) {
          const observed = revision
          const next = await log.next()
          if (closed) return
          if (next) {
            controller.enqueue(encoder.encode(`id: ${next.cursor}\nevent: ${next.event.type}\ndata: ${next.body}\n\n`))
            return
          }
          const manifest = await store.readManifest(runId)
          if (closed) return
          if (["completed", "failed", "canceled"].includes(manifest.status) && !store.execution(runId).isActive()) {
            // A final append may have committed between the EOF read and terminal-state read.
            const final = await log.next()
            if (closed) return
            if (final) {
              controller.enqueue(encoder.encode(`id: ${final.cursor}\nevent: ${final.event.type}\ndata: ${final.body}\n\n`))
              return
            }
            controller.enqueue(encoder.encode(`event: ${RUN_STREAM_END}\ndata: {}\n\n`))
            controller.close()
            await dispose()
            return
          }
          if (Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
            lastHeartbeat = Date.now()
            controller.enqueue(encoder.encode(": heartbeat\n\n"))
            return
          }
          await waitForAppend(observed)
        }
      } catch {
        if (!closed) {
          controller.enqueue(encoder.encode(`event: ${RUN_STREAM_ERROR}\ndata: {}\n\n`))
          controller.close()
        }
        await dispose()
      }
    },
    cancel: dispose,
  }, { highWaterMark: STREAM_BUFFER_BYTES, size: chunk => chunk?.byteLength ?? 0 })
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } })
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
