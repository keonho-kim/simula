/**
 * Purpose: Transport batch creation, progress, and scoped world controls.
 * Pattern: Browser HTTP adapter.
 * Usage: Called by the Multiverse workflow hook.
 * Related: src/shared/multiverse-schema.ts, src/ui/api-client/request-json.ts
 */
import { z } from "zod"
import type { BatchWorldCommand, MultiverseRequest } from "@/shared/multiverse"
import { multiverseRecordSchema, multiverseRequestSchema } from "@/shared/multiverse-schema"
import { RequestJsonError, requestJson, unavailableServerArtifact } from "./request-json"
import { readBrowserArtifact } from "@/ui/browser-storage/database/artifacts/read"
import { saveBrowserArtifact } from "@/ui/browser-storage/database/artifacts/save"
import { saveRunManifest } from "@/ui/browser-storage/database/runs/save-manifest"
import { fetchRun } from "./client"

const response = z.object({ batch: multiverseRecordSchema })
const knownRunIds = new Set<string>()
const hydratedRunIds = new Set<string>()
const TERMINAL_WORLDS = new Set(["completed", "failed", "canceled", "interrupted"])

export async function createMultiverse(request: MultiverseRequest, id: string) {
  const batch = response.parse(await requestJson("/api/multiverse", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": id },
    body: JSON.stringify(multiverseRequestSchema.parse(request)) })).batch
  return saveBrowserArtifact("batch", batch.id, request.scenarioId, batch.status, batch)
}
export async function fetchMultiverse(id: string, signal?: AbortSignal) {
  try {
    const batch = response.parse(await requestJson(`/api/multiverse/${encodeURIComponent(id)}`, { signal })).batch
    await saveBrowserArtifact("batch", batch.id, batch.request.scenarioId, batch.status, batch)
    const newIds = batch.worlds.map(world => world.runId).filter((runId): runId is string => typeof runId === "string" && !knownRunIds.has(runId))
    if (newIds.length) {
      const runs = await fetch("/api/runs", { signal }).then(result => result.ok ? result.json() as Promise<{ runs: import("@/shared").RunManifest[] }> : null).catch(() => null)
      for (const run of runs?.runs ?? []) if (newIds.includes(run.id)) { await saveRunManifest(run); knownRunIds.add(run.id) }
    }
    const finished = batch.worlds.filter(world => world.runId && TERMINAL_WORLDS.has(world.status) && !hydratedRunIds.has(world.runId))
    for (let index = 0; index < finished.length; index += 4) {
      await Promise.all(finished.slice(index, index + 4).map(async world => {
        if (!world.runId) return
        await fetchRun(world.runId)
        hydratedRunIds.add(world.runId)
      }))
    }
    return batch
  } catch (error) {
    if (!unavailableServerArtifact(error)) throw error
    const saved = await readBrowserArtifact<z.infer<typeof multiverseRecordSchema>>("batch", id)
    if (!saved) throw error
    if (error instanceof RequestJsonError && saved.status === "running") {
      const interrupted = multiverseRecordSchema.parse({ ...saved, status: "interrupted", worlds: saved.worlds.map(world =>
        TERMINAL_WORLDS.has(world.status) ? world : { ...world, status: "interrupted", continueAt: undefined }) })
      return saveBrowserArtifact("batch", id, saved.request.scenarioId, interrupted.status, interrupted)
    }
    return saved
  }
}
export async function controlMultiverse(id: string, action: "cancel" | "resume") {
  await requestJson(`/api/multiverse/${encodeURIComponent(id)}/${action}`, { method: "POST" })
}
export async function controlBatchWorld(id: string, worldId: string, command: BatchWorldCommand) {
  const { kind, ...body } = command
  await requestJson(`/api/multiverse/${encodeURIComponent(id)}/worlds/${encodeURIComponent(worldId)}/${kind}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
}
