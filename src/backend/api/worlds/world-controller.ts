/**
 * Purpose: Expose world StoryBuilder preparation, scoped progress, and simulation handoff.
 * Pattern: HTTP controller.
 * Usage: Dispatched under /api/worlds by the backend router.
 * Related: src/backend/runtime/worlds/preparation.ts, src/backend/api/generation/generation-stream.ts
 */
import { z } from "zod"
import { worldPreparationRequestSchema } from "@/shared/world-preparation-schema"
import type { WorldPreparationJobs } from "@/backend/runtime/worlds/preparation"
import { isMissingFileError } from "@/backend/storage/file-errors"
import { streamGenerationProgress } from "../generation/generation-stream"
import { readBoundedJson } from "../request-json"
import { json } from "../responses"

const MAX_WORLD_REQUEST_BYTES = 16 * 1024

export async function routeWorlds(jobs: WorldPreparationJobs, request: Request, url: URL): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean)
  try {
    if (parts.length === 2 && request.method === "POST") {
      const input = worldPreparationRequestSchema.parse(await readBoundedJson(request, MAX_WORLD_REQUEST_BYTES))
      const id = z.uuid().parse(request.headers.get("idempotency-key"))
      try {
        const world = await jobs.store.read(id)
        if (JSON.stringify(world.request) !== JSON.stringify(input)) return json({ error: "World idempotency key has different input." }, { status: 409 })
        return json({ world })
      } catch (error) { if (!isMissingFileError(error)) throw error }
      const source = await jobs.source(input)
      const world = await jobs.store.create(id, input, source.version)
      observeWorld(jobs, id)
      return json({ world }, { status: 202 })
    }
    const id = z.uuid().parse(parts[2])
    const world = await jobs.store.read(id)
    if (parts.length === 3 && request.method === "GET") return json({ world: world.status === "preparing" && !jobs.isRunning(id)
      ? { ...world, status: "failed", issue: "World preparation was interrupted; retry to resume accepted tasks." } : world })
    if (parts.length !== 4) return json({ error: "Not found" }, { status: 404 })
    if (parts[3] === "events" && request.method === "GET") {
      const progress = jobs.progress(id)
      if (!progress) return json({ world }, { status: 409 })
      const taskId = url.searchParams.get("task") ?? undefined
      if (taskId) z.string().regex(/^[a-zA-Z0-9-]{1,160}$/).parse(taskId)
      return streamGenerationProgress(progress, taskId, request.signal)
    }
    if (parts[3] === "task" && request.method === "GET") {
      const task = await jobs.store.readTask(id, url.searchParams.get("id") ?? "")
      return task ? json({ task }) : json({ error: "Accepted task not found." }, { status: 404 })
    }
    if (parts[3] === "retry" && request.method === "POST") {
      if (world.batchId) return json({ error: "Control this world through its batch." }, { status: 409 })
      if (world.status === "ready") return json({ world })
      observeWorld(jobs, id)
      return json({ status: "started" }, { status: 202 })
    }
    if (parts[3] === "cancel" && request.method === "POST") return world.batchId ? json({ error: "Control this world through its batch." }, { status: 409 }) : json({ status: jobs.cancel(id) ? "canceling" : "not_active" })
    if (parts[3] === "run" && request.method === "POST") return world.batchId ? json({ error: "Batch execution owns this run." }, { status: 409 }) : json({ run: await jobs.materializeRun(id) })
    return json({ error: "Not found" }, { status: 404 })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Invalid world request or identifier." }, { status: 400 })
    if (error instanceof RangeError) return json({ error: "World request exceeds the byte limit." }, { status: 413 })
    if (isMissingFileError(error)) return json({ error: "World or confirmed scenario not found." }, { status: 404 })
    return json({ error: "World request could not complete. Confirm the scenario and check preparation status." }, { status: 409 })
  }
}

function observeWorld(jobs: WorldPreparationJobs, id: string): void {
  void jobs.start(id).completion.catch(() => console.error("World persistence failed", { worldId: id }))
}
