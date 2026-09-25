/**
 * Purpose: Coordinate batch creation, bounded status polling, recovery, and world-specific controls.
 * Pattern: Browser workflow hook.
 * Usage: Used by the Multiverse panel for one confirmed scenario.
 * Related: src/ui/api-client/multiverse.ts, src/ui/browser-storage/multiverse-session.ts
 */
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { multiverseRequestSchema } from "@/shared/multiverse-schema"
import { createMultiverse, fetchMultiverse, controlMultiverse, controlBatchWorld } from "@/ui/api-client/multiverse"
import type { BatchWorldCommand } from "@/shared/multiverse"
import { readMultiverseSession, writeMultiverseSession } from "@/ui/browser-storage/multiverse-session"

const BATCH_POLL_MS = 1000

export function useMultiverse(scenarioId: string, fastMode: boolean, open: boolean) {
  const [batchId, setBatchId] = useState(() => readMultiverseSession(scenarioId))
  const [request, setRequest] = useState(() => multiverseRequestSchema.parse({ scenarioId, controls: { fastMode } }))
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [pendingAutomatic, setPendingAutomatic] = useState<{ worldId: string; enabled: boolean }>()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ["multiverse", batchId], enabled: !!batchId && open && !busy, retry: false,
    queryFn: ({ signal }) => fetchMultiverse(batchId ?? "", signal),
    refetchInterval: current => current.state.data?.status === "running" ? BATCH_POLL_MS : false,
    refetchIntervalInBackground: false,
  })

  async function perform(action: () => Promise<void>) {
    if (busy) return
    setBusy(true); setFailed(false)
    try { await action() } catch { setFailed(true) } finally { setBusy(false) }
  }
  const create = () => perform(async () => {
    const id = batchId ?? crypto.randomUUID()
    writeMultiverseSession(scenarioId, id); setBatchId(id)
    client.setQueryData(["multiverse", id], await createMultiverse(request, id))
  })
  const control = (action: "cancel" | "resume") => perform(async () => {
    if (!batchId) return
    await controlMultiverse(batchId, action)
    client.setQueryData(["multiverse", batchId], await fetchMultiverse(batchId))
  })
  const controlWorld = (worldId: string, command: BatchWorldCommand) => perform(async () => {
    if (!batchId) return
    if (command.kind === "automatic") setPendingAutomatic({ worldId, enabled: command.enabled })
    const key = ["multiverse", batchId]
    await client.cancelQueries({ queryKey: key })
    const previous = query.data
    if (previous && command.kind === "automatic") client.setQueryData(key, { ...previous,
      worlds: previous.worlds.map(world => world.id === worldId ? { ...world, autoContinue: command.enabled } : world),
    })
    try {
      await controlBatchWorld(batchId, worldId, command)
      client.setQueryData(key, await fetchMultiverse(batchId))
    } catch (error) { if (previous) client.setQueryData(key, previous); throw error }
    finally { setPendingAutomatic(undefined) }
  })
  const reset = () => { writeMultiverseSession(scenarioId); setBatchId(undefined); setFailed(false) }
  const batch = query.data && pendingAutomatic ? { ...query.data, worlds: query.data.worlds.map(world => world.id === pendingAutomatic.worldId
    ? { ...world, autoContinue: pendingAutomatic.enabled } : world) } : query.data
  return { request, setRequest, batch, busy, failed: failed || query.isError, create, control, controlWorld, reset,
    refresh: () => { setFailed(false); void query.refetch() } }
}
