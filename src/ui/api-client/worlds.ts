/**
 * Purpose: Transport independent world preparation and prepared-run creation.
 * Pattern: Browser HTTP adapter.
 * Usage: Called by world launch UI and application run composition.
 * Related: src/shared/world-preparation-schema.ts, src/ui/api-client/request-json.ts
 */
import { z } from "zod"
import type { WorldPreparationRequest } from "@/shared/world-preparation"
import type { RunManifest } from "@/shared/run"
import { worldPreparationRecordSchema } from "@/shared/world-preparation-schema"
import { runManifestSchema } from "@/shared/run-schema"
import { RequestJsonError, requestJson, unavailableServerArtifact } from "./request-json"
import { readBrowserArtifact } from "@/ui/browser-storage/database/artifacts/read"
import { saveBrowserArtifact } from "@/ui/browser-storage/database/artifacts/save"
import { saveRunManifest } from "@/ui/browser-storage/database/runs/save-manifest"

export async function prepareWorld(input: WorldPreparationRequest, id: string) {
  const world = z.object({ world: worldPreparationRecordSchema }).parse(await requestJson("/api/worlds", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": id }, body: JSON.stringify(input),
  })).world
  return saveBrowserArtifact("world", world.id, input.scenarioId, world.status, world)
}

export async function fetchWorld(id: string, signal?: AbortSignal) {
  try {
    const world = z.object({ world: worldPreparationRecordSchema }).parse(await requestJson(`/api/worlds/${encodeURIComponent(id)}`, { signal })).world
    return saveBrowserArtifact("world", world.id, world.request.scenarioId, world.status, world)
  } catch (error) {
    if (!unavailableServerArtifact(error)) throw error
    const saved = await readBrowserArtifact<z.infer<typeof worldPreparationRecordSchema>>("world", id)
    if (!saved) throw error
    if (error instanceof RequestJsonError && saved.status === "preparing") {
      const interrupted = worldPreparationRecordSchema.parse({ ...saved, status: "failed", issue: "World preparation was interrupted by a server restart." })
      return saveBrowserArtifact("world", id, saved.request.scenarioId, interrupted.status, interrupted)
    }
    return saved
  }
}

export async function controlWorld(id: string, action: "retry" | "cancel") {
  await requestJson(`/api/worlds/${encodeURIComponent(id)}/${action}`, { method: "POST" })
  return fetchWorld(id)
}

export async function createWorldRun(worldId: string): Promise<RunManifest> {
  const run = z.object({ run: runManifestSchema }).parse(await requestJson(`/api/worlds/${encodeURIComponent(worldId)}/run`, { method: "POST" })).run
  await saveRunManifest(run)
  return run
}
