import { useEffect, type MutableRefObject } from "react"
import type { QueryClient } from "@tanstack/react-query"
import type { RunEvent } from "@simula/shared"

const eventTypes: RunEvent["type"][] = [
  "run.started",
  "node.started",
  "node.completed",
  "node.failed",
  "model.message",
  "model.reasoning",
  "model.metrics",
  "actors.ready",
  "event.injected",
  "interaction.recorded",
  "actor.message",
  "round.completed",
  "graph.delta",
  "log",
  "report.delta",
  "run.completed",
  "run.failed",
  "run.canceled",
]

interface UseRunEventStreamInput {
  selectedRunId?: string
  selectedRunIdRef: MutableRefObject<string | undefined>
  viewModeRef: MutableRefObject<"home" | "simulation" | "report">
  queryClient: QueryClient
  resetLiveState: () => void
  pushEvents: (events: RunEvent[]) => void
  setReportConfirmRunId: (runId: string | undefined) => void
}

export function useRunEventStream({
  selectedRunId,
  selectedRunIdRef,
  viewModeRef,
  queryClient,
  resetLiveState,
  pushEvents,
  setReportConfirmRunId,
}: UseRunEventStreamInput): void {
  useEffect(() => {
    if (!selectedRunId) {
      return
    }
    resetLiveState()
    const source = new EventSource(`/api/runs/${selectedRunId}/events`)
    const queuedEvents: RunEvent[] = []
    let scheduledFrame: number | undefined
    const flushEvents = () => {
      scheduledFrame = undefined
      const events = queuedEvents.splice(0)
      if (events.length) {
        pushEvents(events)
      }
    }
    const listeners = eventTypes.map((type) => {
      const listener = (message: MessageEvent<string>) => {
        const event = JSON.parse(message.data) as RunEvent
        queuedEvents.push(event)
        scheduledFrame ??= window.requestAnimationFrame(flushEvents)
        if (
          event.type === "run.completed" &&
          event.runId === selectedRunIdRef.current &&
          viewModeRef.current === "simulation"
        ) {
          setReportConfirmRunId(event.runId)
        }
        if (event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled") {
          void queryClient.invalidateQueries({ queryKey: ["runs"] })
          void queryClient.invalidateQueries({ queryKey: ["runs", selectedRunId] })
        }
      }
      source.addEventListener(type, listener)
      return { type, listener }
    })
    source.onerror = () => {
      source.close()
    }
    return () => {
      for (const item of listeners) {
        source.removeEventListener(item.type, item.listener)
      }
      if (scheduledFrame !== undefined) {
        window.cancelAnimationFrame(scheduledFrame)
      }
      source.close()
    }
  }, [pushEvents, queryClient, resetLiveState, selectedRunId, selectedRunIdRef, setReportConfirmRunId, viewModeRef])
}
