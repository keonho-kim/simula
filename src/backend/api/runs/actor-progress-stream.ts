/**
 * Purpose: Deliver bounded current-round actor previews with reconnect snapshots and cleanup.
 * Pattern: SSE transport adapter.
 * Usage: GET /api/runs/:runId/actor-progress after scoped run access checks.
 * Related: src/backend/runtime/actor-progress.ts, src/backend/api/routes.ts
 */
import type { ActorProgress } from "@/backend/runtime/actor-progress"
import { ACTOR_PROGRESS_MAX_BYTES, type ActorProgressSnapshot } from "@/shared/actor-progress"

const HEARTBEAT_MS = 15_000
export function streamActorProgress(progress: ActorProgress, runId: string, signal: AbortSignal): Response {
  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let closed = false
  let latest: ActorProgressSnapshot | undefined
  let wake: (() => void) | undefined
  let closeStream: (() => void) | undefined
  const cleanup = () => { closed = true; unsubscribe?.(); clearInterval(heartbeat); signal.removeEventListener("abort", abort); wake?.() }
  const abort = () => { if (!closed) { cleanup(); closeStream?.() } }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      closeStream = () => controller.close()
      if (signal.aborted) { abort(); return }
      signal.addEventListener("abort", abort, { once: true })
      unsubscribe = progress.subscribe(runId, snapshot => { latest = snapshot; wake?.() })
      heartbeat = setInterval(() => wake?.(), HEARTBEAT_MS)
      controller.enqueue(encoder.encode(": connected\nretry: 1000\n\n"))
    },
    async pull(controller) {
      if (!latest && !closed) await new Promise<void>(resolve => { wake = resolve })
      wake = undefined
      if (closed) return
      const snapshot = latest
      latest = undefined
      if (!snapshot) { controller.enqueue(encoder.encode(": heartbeat\n\n")); return }
      const bytes = encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`)
      if (bytes.byteLength > ACTOR_PROGRESS_MAX_BYTES) { cleanup(); controller.error(new Error("Actor preview exceeds stream capacity.")); return }
      controller.enqueue(bytes)
      if (snapshot.status !== "running") { cleanup(); controller.close() }
    },
    cancel: cleanup,
  }, { highWaterMark: 1 })
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } })
}
