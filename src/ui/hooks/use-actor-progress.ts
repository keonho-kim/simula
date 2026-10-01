/**
 * Purpose: Subscribe to transient actor snapshots only while the live conversation is visible.
 * Pattern: Lifecycle subscription with frame batching and reconnect recovery.
 * Usage: Owned by ActorRail; no previews are written to browser storage.
 * Related: src/shared/actor-progress.ts, src/ui/models/actors/live-conversation.ts
 */
import { useEffect, useState } from "react"
import { ACTOR_PROGRESS_MAX_BYTES, ACTOR_PROGRESS_RECONNECT_MS, parseActorProgress, type ActorProgressSnapshot } from "@/shared/actor-progress"

export function useActorProgress(runId: string | undefined, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<ActorProgressSnapshot>()
  const [liveUpdate, setLiveUpdate] = useState(false)
  const [disconnected, setDisconnected] = useState(false)
  useEffect(() => {
    setSnapshot(previous => previous?.runId === runId ? previous : undefined)
    setDisconnected(false)
    if (!runId || !enabled) return
    let source: EventSource | undefined
    let frame: number | undefined
    let pending: ActorProgressSnapshot | undefined
    let latest: ActorProgressSnapshot | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let ended = false
    let disposed = false
    let pendingLive = false
    const close = () => { source?.close(); source = undefined; clearTimeout(retry); if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined }
    const flush = () => {
      if (!pending || disposed) return
      setSnapshot(pending)
      setLiveUpdate(pendingLive)
      ended = pending.status !== "running"
      pending = undefined
    }
    const connect = () => {
      if (disposed || ended || document.hidden) return
      close()
      let firstSnapshot = true
      const connection = new EventSource(`/api/runs/${encodeURIComponent(runId)}/actor-progress`)
      source = connection
      connection.onopen = () => setDisconnected(false)
      connection.onerror = () => {
        if (disposed || ended || source !== connection) return
        flush()
        setDisconnected(!ended)
        close()
        if (ended) return
        retry = setTimeout(connect, ACTOR_PROGRESS_RECONNECT_MS)
      }
      connection.addEventListener("snapshot", (message: MessageEvent<string>) => {
        if (disposed || source !== connection) return
        try {
          if (new TextEncoder().encode(message.data).byteLength > ACTOR_PROGRESS_MAX_BYTES) throw new Error("Oversized preview.")
          const next = parseActorProgress(JSON.parse(message.data), runId)
          if (latest?.streamId === next.streamId && next.revision <= latest.revision) return
          pendingLive = !firstSnapshot
          firstSnapshot = false
          latest = next
          pending = next
          frame ??= requestAnimationFrame(() => {
            frame = undefined
            flush()
            if (ended) close()
          })
        } catch { setDisconnected(true); ended = true; close() }
      })
    }
    const visibility = () => { if (document.hidden) { flush(); close() }; if (!document.hidden) connect() }
    connect()
    document.addEventListener("visibilitychange", visibility)
    return () => { disposed = true; close(); document.removeEventListener("visibilitychange", visibility) }
  }, [runId, enabled])
  return { snapshot: snapshot?.runId === runId ? snapshot : undefined, disconnected, liveUpdate }
}
