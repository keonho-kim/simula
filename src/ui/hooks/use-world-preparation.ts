/**
 * Purpose: Coordinate one world's preparation, recovery, and resumable launch state.
 * Pattern: Browser workflow hook.
 * Usage: Used by the confirmed scenario's world launch panel.
 * Related: src/ui/api-client/worlds.ts, src/ui/browser-storage/world-session.ts
 */
import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { worldControlsSchema } from "@/shared/world-preparation-schema"
import { prepareWorld, fetchWorld, controlWorld } from "@/ui/api-client/worlds"
import { readWorldSession, writeWorldSession } from "@/ui/browser-storage/world-session"

const WORLD_POLL_MS = 1000

export function useWorldPreparation(scenarioId: string, fastMode: boolean, open: boolean) {
  const [worldId, setWorldId] = useState(() => readWorldSession(scenarioId))
  const [controls, setControls] = useState(() => worldControlsSchema.parse({ fastMode }))
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const loaded = useRef<string | undefined>(undefined)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ["world", worldId], enabled: !!worldId && open && !busy, retry: false,
    queryFn: ({ signal }) => fetchWorld(worldId ?? "", signal),
    refetchInterval: current => current.state.data?.status === "preparing" ? WORLD_POLL_MS : false,
  })
  useEffect(() => {
    if (query.data && loaded.current !== query.data.id) {
      loaded.current = query.data.id
      setControls(worldControlsSchema.parse(query.data.request.controls))
    }
  }, [query.data])

  async function prepare() {
    if (busy) return
    setBusy(true); setFailed(false)
    const id = worldId ?? crypto.randomUUID()
    writeWorldSession(scenarioId, id); setWorldId(id)
    try { client.setQueryData(["world", id], await prepareWorld({ scenarioId, controls }, id)) }
    catch { setFailed(true) }
    finally { setBusy(false) }
  }

  async function control(action: "retry" | "cancel") {
    if (!worldId || busy) return
    setBusy(true); setFailed(false)
    try {
      const world = await controlWorld(worldId, action)
      client.setQueryData(["world", worldId], action === "retry" ? { ...world, status: "preparing" } : world)
    } catch { setFailed(true) }
    finally { setBusy(false) }
  }

  function reset() { writeWorldSession(scenarioId); setWorldId(undefined); setFailed(false) }
  return { controls, setControls, prepare, control, reset, world: query.data, busy, failed: failed || query.isError,
    refresh: () => { setFailed(false); if (worldId) void query.refetch() } }
}
