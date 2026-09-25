/**
 * Purpose: Resume scoped run events after disconnects with bounded animation-frame batching.
 * Pattern: Browser subscription lifecycle.
 * Usage: Mounted by App for the selected simulation run.
 * Related: src/shared/run-stream.ts, src/ui/browser-storage/database/runs/append-events.ts
 */
import { MAX_RUN_EVENT_BYTES, RUN_EVENT_TYPES, RUN_STREAM_END, RUN_STREAM_ERROR, parseRunCursor, parseRunEventEnvelope } from "@/shared/run-stream"
import { toast } from "sonner"
import { useEffect, useState, type MutableRefObject } from "react"
import type { QueryClient } from "@tanstack/react-query"
import type { RunEvent } from "@/shared"
import { appendRunEvents } from "@/ui/browser-storage/database/runs/append-events"
import { lastRunEventSequence } from "@/ui/browser-storage/database/runs/last-event-sequence"

const MAX_PENDING_EVENTS = 128
const RECONNECT_DELAY_MS = 1000
const encoder = new TextEncoder()

interface UseRunEventStreamInput {
  selectedRunId?: string
  selectedRunStatus?: string
  streamErrorText: string
  selectedRunIdRef: MutableRefObject<string | undefined>
  viewModeRef: MutableRefObject<"home" | "simulation" | "report">
  queryClient: QueryClient
  resetLiveState: () => void
  pushEvents: (events: RunEvent[]) => void
  setReportConfirmRunId: (runId: string | undefined) => void
}

export function useRunEventStream({
  selectedRunId,
  selectedRunStatus,
  streamErrorText,
  selectedRunIdRef,
  viewModeRef,
  queryClient,
  resetLiveState,
  pushEvents,
  setReportConfirmRunId,
}: UseRunEventStreamInput): void {
  const [subscribedRun, setSubscribedRun] = useState<string>()
  const terminal = ["completed", "failed", "canceled", "interrupted"].includes(selectedRunStatus ?? "")
  const shouldSubscribe = Boolean(selectedRunId && selectedRunStatus && (!terminal || subscribedRun === selectedRunId))
  useEffect(() => {
    if (!selectedRunId || !shouldSubscribe) {
      return
    }
    setSubscribedRun(selectedRunId)
    resetLiveState()
    let source: EventSource | undefined
    let disposed = false
    let ended = false
    let offset = 0
    let committedOffset = 0
    let acknowledgedOffset = 0
    let confirming = false
    let retry: ReturnType<typeof setTimeout> | undefined
    const queuedEvents: Array<{ sequence: number; event: RunEvent }> = []
    let pendingBytes = 0
    let scheduledFrame: number | undefined
    let writing = Promise.resolve()
    const confirmSavedEvents = async () => {
      if (confirming || disposed || !committedOffset) return
      confirming = true
      try {
        while (!disposed && acknowledgedOffset < committedOffset) {
          const target = committedOffset
          const response = await fetch(`/api/runs/${encodeURIComponent(selectedRunId)}/ack`, { method: "POST",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cursor: `${selectedRunId}:${target}` }) })
          if (!response.ok) break
          acknowledgedOffset = target
        }
      } catch { /* The next committed batch retries; browser SQLite remains authoritative. */ }
      finally { confirming = false }
    }
    const flushEvents = () => {
      if (scheduledFrame !== undefined) window.cancelAnimationFrame(scheduledFrame)
      scheduledFrame = undefined
      const batch = queuedEvents.splice(0)
      pendingBytes = 0
      if (!batch.length) return
      writing = writing.then(async () => {
        await appendRunEvents(selectedRunId, batch)
        if (disposed) return
        committedOffset = batch.at(-1)!.sequence
        void confirmSavedEvents()
        const events = batch.map(value => value.event)
        pushEvents(events)
        if (events.some(event => event.type === "run.completed") && selectedRunId === selectedRunIdRef.current && viewModeRef.current === "simulation") {
          setReportConfirmRunId(selectedRunId)
        }
        if (events.some(event => event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled")) {
          await queryClient.invalidateQueries({ queryKey: ["runs"] })
          await queryClient.invalidateQueries({ queryKey: ["runs", selectedRunId] })
        }
      }).catch(() => { ended = true; close(); toast.error(streamErrorText) })
    }
    const close = () => { source?.close(); source = undefined; clearTimeout(retry) }
    const resync = () => {
      close()
      flushEvents()
      void writing.finally(() => { if (!disposed) retry = setTimeout(connect, RECONNECT_DELAY_MS) })
    }
    const connect = () => {
      if (disposed || ended || document.hidden) return
      close()
      const after = committedOffset ? `?after=${encodeURIComponent(`${selectedRunId}:${committedOffset}`)}` : ""
      source = new EventSource(`/api/runs/${encodeURIComponent(selectedRunId)}/events${after}`)
      const connection = source
      for (const type of RUN_EVENT_TYPES) {
        source.addEventListener(type, (message: MessageEvent<string>) => {
          if (disposed || source !== connection) return
          try {
            const nextOffset = parseRunCursor(message.lastEventId, selectedRunId)
            if (nextOffset <= offset) return
            const bytes = encoder.encode(message.data).byteLength
            if (bytes > MAX_RUN_EVENT_BYTES || nextOffset - bytes - 1 !== offset) { resync(); return }
            const event = parseRunEventEnvelope(JSON.parse(message.data), selectedRunId)
            if (event.type !== type) { resync(); return }
            if (queuedEvents.length >= MAX_PENDING_EVENTS || pendingBytes + bytes > MAX_RUN_EVENT_BYTES) flushEvents()
            queuedEvents.push({ sequence: nextOffset, event })
            pendingBytes += bytes
            offset = nextOffset
            scheduledFrame ??= window.requestAnimationFrame(flushEvents)
            const terminal = event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled"
            if (terminal) flushEvents()
          } catch { resync() }
        })
      }
      // EventSource reconnects automatically with Last-Event-ID after transient errors.
      source.onerror = flushEvents
      source.addEventListener(RUN_STREAM_END, () => { ended = true; flushEvents(); close() })
      source.addEventListener(RUN_STREAM_ERROR, () => { ended = true; flushEvents(); close(); toast.error(streamErrorText) })
    }
    const visibility = () => {
      if (document.hidden) { close(); flushEvents() }
      else connect()
    }
    void lastRunEventSequence(selectedRunId).then(sequence => {
      if (disposed) return
      offset = sequence
      committedOffset = sequence
      void confirmSavedEvents()
      connect()
    }).catch(() => { ended = true; toast.error(streamErrorText) })
    document.addEventListener("visibilitychange", visibility)
    return () => {
      disposed = true
      close()
      document.removeEventListener("visibilitychange", visibility)
      if (scheduledFrame !== undefined) window.cancelAnimationFrame(scheduledFrame)
    }

  }, [pushEvents, queryClient, resetLiveState, selectedRunId, shouldSubscribe, selectedRunIdRef, setReportConfirmRunId, viewModeRef, streamErrorText])
}
