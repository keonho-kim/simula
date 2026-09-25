/**
 * Purpose: Expose scenario-build creation, review, scoped streaming, and recovery.
 * Pattern: HTTP controller.
 * Usage: Dispatched by API routes under /api/scenario-builder.
 * Related: src/backend/runtime/scenario-builder/jobs.ts, src/backend/api/generation/generation-stream.ts
 */
import { z } from "zod"
import { parseBuilderRequest } from "@/backend/core/scenario-builder/contracts"
import type { ScenarioBuilderJobs } from "@/backend/runtime/scenario-builder/jobs"
import { isMissingFileError } from "@/backend/storage/file-errors"
import { streamGenerationProgress } from "../generation/generation-stream"
import { readBoundedJson } from "../request-json"
import { json } from "../responses"

const MAX_BUILDER_BODY_BYTES = 32 * 1024

export async function routeScenarioBuilder(jobs: ScenarioBuilderJobs, request: Request, url: URL): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean)
  try {
    if (parts.length === 2 && request.method === "POST") {
      const body = await readBoundedJson(request, MAX_BUILDER_BODY_BYTES)
      const input = parseBuilderRequest(body)
      const id = z.uuid().parse(request.headers.get("idempotency-key"))
      try {
        const existing = await jobs.store.read(id)
        if (JSON.stringify(existing.request) !== JSON.stringify(input)) return json({ error: "The idempotency key belongs to different input." }, { status: 409 })
        return json({ build: existing })
      } catch (error) { if (!isMissingFileError(error)) throw error }
      try { await jobs.captureSource(input) }
      catch { return json({ error: "Extract the current document revision before generating a scenario." }, { status: 409 }) }
      const build = await jobs.store.create(id, input)
      observeJob(jobs, id)
      return json({ build }, { status: 202 })
    }
    const id = z.uuid().parse(parts[2])
    const build = await jobs.store.read(id)
    if (parts.length === 3 && request.method === "GET") return json({ build: build.status === "running" && !jobs.isRunning(id)
      ? { ...build, status: "failed", issue: "Scenario generation was interrupted; retry to resume accepted tasks." } : build })
    if (parts.length !== 4) return json({ error: "Not found" }, { status: 404 })
    if (parts[3] === "events" && request.method === "GET") {
      const progress = jobs.progress(id)
      if (!progress) return json({ build }, { status: 409 })
      const taskId = url.searchParams.get("task") ?? undefined
      if (taskId) z.string().regex(/^[a-zA-Z0-9-]{1,160}$/).parse(taskId)
      return streamGenerationProgress(progress, taskId, request.signal)
    }
    if (parts[3] === "task" && request.method === "GET") {
      const taskId = url.searchParams.get("id") ?? ""
      const task = await jobs.store.readTask(id, taskId)
      return task ? json({ task }) : json({ error: "Accepted task not found." }, { status: 404 })
    }
    if (parts[3] === "cancel" && request.method === "POST") return json({ status: jobs.cancel(id) ? "canceling" : "not_active" })
    if (parts[3] === "retry" && request.method === "POST") {
      if (build.status === "confirmed" || build.status === "review") return json({ build })
      observeJob(jobs, id)
      return json({ status: "started" }, { status: 202 })
    }
    if (parts[3] === "confirm" && request.method === "POST") {
      try { return json({ build: await jobs.confirm(id) }) }
      catch { return json({ error: "Resolve blocking issues and verify the source revision before confirming." }, { status: 409 }) }
    }
    return json({ error: "Not found" }, { status: 404 })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Invalid scenario request or identifier." }, { status: 400 })
    if (isMissingFileError(error)) return json({ error: "Scenario build or document set not found." }, { status: 404 })
    if (error instanceof RangeError) return json({ error: "Scenario request exceeds 32 KiB." }, { status: 413 })
    if (error instanceof Error && "code" in error && error.code === "EEXIST") return json({ error: "This build is being created; reload its status." }, { status: 409 })
    return json({ error: "Scenario request failed; check the input and retry." }, { status: 400 })
  }
}

function observeJob(jobs: ScenarioBuilderJobs, id: string): void {
  void jobs.start(id).completion.catch(() => console.error("Scenario build persistence failed", { buildId: id }))
}
