/**
 * Purpose: Subscribe only to visible generation progress and selected-task text.
 * Pattern: Lifecycle subscription with animation-frame batching.
 * Usage: Called by builder and analytical report activity panels.
 * Related: src/ui/models/generation/progress.ts
 */
import { useEffect, useState } from "react"
import { emptyGenerationProgress, reduceGenerationProgress } from "@/ui/models/generation/progress"

const RECONNECT_DELAY_MS = 1000
const MAX_EVENT_CHARS = 128 * 1024
const MAX_PENDING_EVENTS = 128

export function useGenerationStream(buildId: string, taskId: string | undefined, enabled: boolean, channel: "scenario-builder" | "worlds" | "analysis" = "scenario-builder") {
  const [state, setState] = useState(emptyGenerationProgress)
  const [disconnected, setDisconnected] = useState(false)
  useEffect(() => {
    setState(emptyGenerationProgress())
    if (!enabled) return
    let source: EventSource | undefined
    let frame = 0
    let pending: unknown[] = []
    let retry: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    let current = emptyGenerationProgress()
    const close = () => { source?.close(); source = undefined; clearTimeout(retry); cancelAnimationFrame(frame); frame = 0; pending = [] }
    const connect = () => {
      if (disposed || document.hidden) return
      close()
      const url = `/api/${channel}/${encodeURIComponent(buildId)}/events${taskId ? `?task=${encodeURIComponent(taskId)}` : ""}`
      source = new EventSource(url)
      source.onopen = () => setDisconnected(false)
      source.onerror = () => setDisconnected(true)
      const receive = (message: MessageEvent<string>) => {
        if (pending.length >= MAX_PENDING_EVENTS) { close(); setDisconnected(true); retry = setTimeout(connect, RECONNECT_DELAY_MS); return }
        if (message.data.length > MAX_EVENT_CHARS) { close(); setDisconnected(true); return }
        try { pending.push(JSON.parse(message.data)) }
        catch { close(); setDisconnected(true); return }
        if (frame) return
        frame = requestAnimationFrame(() => {
          frame = 0
          for (const event of pending) current = reduceGenerationProgress(current, event)
          pending = []
          setState(current)
          if (current.terminal) close()
          else if (current.resync) { close(); setDisconnected(true); retry = setTimeout(connect, RECONNECT_DELAY_MS) }
        })
      }
      source.addEventListener("snapshot", receive)
      source.addEventListener("event", receive)
      source.addEventListener("terminal", receive)
    }
    const visibility = () => { if (document.hidden) close(); else connect() }
    connect()
    document.addEventListener("visibilitychange", visibility)
    return () => { disposed = true; close(); document.removeEventListener("visibilitychange", visibility) }
  }, [buildId, taskId, enabled, channel])
  return { ...state, disconnected }
}
