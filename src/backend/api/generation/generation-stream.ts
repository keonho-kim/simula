/**
 * Purpose: Deliver scoped generation progress without letting slow readers block model work.
 * Pattern: SSE transport adapter.
 * Usage: Invoked by builder, world-preparation, and analytical report event requests.
 * Related: src/backend/runtime/generation/progress.ts
 */
import type { GenerationProgress } from "@/backend/runtime/generation/progress"

const MAX_QUEUED_BYTES = 128 * 1024

export function streamGenerationProgress(progress: GenerationProgress, taskId: string | undefined, signal: AbortSignal): Response {
  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | undefined
  let stop: (() => void) | undefined
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      stop = () => {
        if (closed) return
        closed = true
        unsubscribe?.()
        if (stop) signal.removeEventListener("abort", stop)
        controller.close()
      }
      if (signal.aborted) { stop(); return }
      signal.addEventListener("abort", stop, { once: true })
      unsubscribe = progress.subscribe(taskId, event => {
        if (closed) return
        const bytes = encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
        if ((controller.desiredSize ?? 0) < bytes.byteLength) { stop?.(); return }
        controller.enqueue(bytes)
        if (event.type === "terminal") stop?.()
      })
      if (closed) unsubscribe()
    },
    cancel() { unsubscribe?.(); if (stop) signal.removeEventListener("abort", stop) },
  }, { highWaterMark: MAX_QUEUED_BYTES, size: chunk => chunk?.byteLength ?? 0 })
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } })
}
