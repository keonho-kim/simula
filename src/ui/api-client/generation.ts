/**
 * Purpose: Retrieve accepted generated task values by scoped execution identity.
 * Pattern: Browser HTTP adapter.
 * Usage: Used by builder and analytical report detail views.
 * Related: src/ui/api-client/request-json.ts, src/shared/generation.ts
 */
import { z } from "zod"
import { requestJson as request, unavailableServerArtifact } from "./request-json"
import { readBrowserArtifact } from "@/ui/browser-storage/database/artifacts/read"
import { saveBrowserArtifact } from "@/ui/browser-storage/database/artifacts/save"

export async function fetchGenerationTask(buildId: string, taskId: string, signal?: AbortSignal, channel: "scenario-builder" | "worlds" | "analysis" = "scenario-builder"): Promise<unknown> {
  const key = `${channel}:${buildId}:${taskId}`
  try {
    const value = z.object({ task: z.object({ value: z.unknown() }) }).parse(await request(
      `/api/${channel}/${encodeURIComponent(buildId)}/task?id=${encodeURIComponent(taskId)}`, { signal },
    )).task.value
    return saveBrowserArtifact("generated-task", key, buildId, "accepted", value)
  } catch (error) {
    if (!unavailableServerArtifact(error)) throw error
    const saved = await readBrowserArtifact<unknown>("generated-task", key)
    if (saved !== undefined) return saved
    throw error
  }
}
