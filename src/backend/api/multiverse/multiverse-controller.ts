/**
 * Purpose: Expose bounded Multiverse creation, recovery, cancellation, and world controls.
 * Pattern: HTTP controller.
 * Usage: Dispatched under /api/multiverse by the API router.
 * Related: src/backend/runtime/multiverse/jobs.ts, src/shared/multiverse-schema.ts
 */
import { z } from "zod"
import { multiverseRequestSchema } from "@/shared/multiverse-schema"
import type { MultiverseJobs } from "@/backend/runtime/multiverse/jobs"
import { isMissingFileError } from "@/backend/storage/file-errors"
import { readBoundedJson } from "../request-json"
import { json } from "../responses"

const MAX_BATCH_REQUEST_BYTES = 16 * 1024

export async function routeMultiverse(jobs: MultiverseJobs, request: Request, url: URL): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean)
  try {
    if (parts.length === 2 && request.method === "POST") {
      const input = multiverseRequestSchema.parse(await readBoundedJson(request, MAX_BATCH_REQUEST_BYTES))
      const id = z.uuid().parse(request.headers.get("idempotency-key"))
      const batch = await jobs.create(id, input)
      observe(jobs, id)
      return json({ batch }, { status: 202 })
    }
    const id = z.uuid().parse(parts[2])
    if (parts.length === 3 && request.method === "GET") return json({ batch: await jobs.read(id) })
    if (parts.length === 4 && request.method === "POST") {
      if (parts[3] === "resume") { await jobs.read(id); observe(jobs, id); return json({ status: "started" }, { status: 202 }) }
      if (parts[3] === "cancel") { await jobs.cancel(id); return json({ status: "canceling" }, { status: 202 }) }
    }
    if (parts.length === 6 && parts[3] === "worlds" && request.method === "POST") {
      const worldId = z.uuid().parse(parts[4])
      if (parts[5] === "cancel") { await jobs.cancel(id, worldId); return json({ status: "canceling" }, { status: 202 }) }
      if (parts[5] === "automatic") {
        const { enabled } = z.object({ enabled: z.boolean() }).strict().parse(await readBoundedJson(request, MAX_BATCH_REQUEST_BYTES))
        await jobs.automatic(id, worldId, enabled)
        return json({ status: "accepted" }, { status: 202 })
      }
      if (parts[5] === "continue") {
        const { roundIndex } = z.object({ roundIndex: z.number().int().positive() }).strict().parse(await readBoundedJson(request, MAX_BATCH_REQUEST_BYTES))
        await jobs.continue(id, worldId, roundIndex)
        return json({ status: "accepted" }, { status: 202 })
      }
    }
    return json({ error: "Not found" }, { status: 404 })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Invalid batch request or identifier." }, { status: 400 })
    if (error instanceof RangeError) return json({ error: "Batch request exceeds its size limit." }, { status: 413 })
    if (isMissingFileError(error)) return json({ error: "Batch or confirmed scenario not found." }, { status: 404 })
    return json({ error: "Batch request could not complete. Check its current status and confirmed scenario." }, { status: 409 })
  }
}

function observe(jobs: MultiverseJobs, id: string): void {
  void jobs.start(id).catch(() => console.error("Batch execution interrupted", { batchId: id }))
}
