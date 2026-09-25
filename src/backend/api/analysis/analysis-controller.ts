/**
 * Purpose: Expose analytical report discovery, generation, scoped streams, and source-linked results.
 * Pattern: HTTP report controller.
 * Usage: Dispatched under /api/analysis by the backend router.
 * Related: src/backend/runtime/analysis/jobs.ts, src/backend/api/generation/generation-stream.ts
 */
import { z } from "zod"
import { analysisLookupSchema, analysisSubjectSchema, resourceAccountingSchema } from "@/shared/analytical-report-schema"
import type { AnalysisJobs } from "@/backend/runtime/analysis/jobs"
import { isMissingFileError } from "@/backend/storage/file-errors"
import { readBoundedJson } from "../request-json"
import { streamGenerationProgress } from "../generation/generation-stream"
import { json } from "../responses"

const MAX_ANALYSIS_REQUEST_BYTES = 8192
const MAX_ANALYSIS_EXPORT_BYTES = 8 * 1024 * 1024

export async function routeAnalysis(jobs: AnalysisJobs, request: Request, url: URL): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean)
  try {
    if (parts.length === 2 && request.method === "GET") {
      const subject = analysisSubjectSchema.parse({ kind: url.searchParams.get("kind"), id: url.searchParams.get("subject") })
      return json(analysisLookupSchema.parse(await jobs.lookup(subject)))
    }
    if (parts.length === 2 && request.method === "POST") {
      const { subject } = z.object({ subject: analysisSubjectSchema }).strict().parse(await readBoundedJson(request, MAX_ANALYSIS_REQUEST_BYTES))
      const id = z.uuid().parse(request.headers.get("idempotency-key"))
      const analysis = await jobs.create(id, subject)
      observe(jobs, id)
      return json({ analysis }, { status: 202 })
    }
    const id = z.uuid().parse(parts[2])
    const analysis = await jobs.read(id)
    if (parts.length === 3 && request.method === "GET") return json({ analysis })
    if (parts.length !== 4) return json({ error: "Not found" }, { status: 404 })
    if (parts[3] === "retry" && request.method === "POST") { observe(jobs, id); return json({ status: "started" }, { status: 202 }) }
    if (parts[3] === "cancel" && request.method === "POST") return json({ status: jobs.cancel(id) ? "canceling" : "not_active" })
    if (parts[3] === "events" && request.method === "GET") {
      const progress = jobs.progress(id)
      if (!progress) return json({ analysis }, { status: 409 })
      const taskId = url.searchParams.get("task") ?? undefined
      if (taskId) z.string().regex(/^[a-zA-Z0-9-]{1,160}$/).parse(taskId)
      return streamGenerationProgress(progress, taskId, request.signal)
    }
    if (parts[3] === "task" && request.method === "GET") {
      const task = await jobs.store.readTask(id, url.searchParams.get("id") ?? "")
      return task ? json({ task }) : json({ error: "Accepted analysis task not found." }, { status: 404 })
    }
    if (parts[3] === "reference" && request.method === "GET") {
      const reference = await jobs.store.readReference(id, url.searchParams.get("id") ?? "")
      return reference ? json({ reference }) : json({ error: "Reference not found in this report." }, { status: 404 })
    }
    if (parts[3] === "metrics" && request.method === "GET") return json({ calls: await jobs.store.readMetrics(id) })
    if (parts[3] === "accounting" && request.method === "GET") return json({ accounting: resourceAccountingSchema.parse(await jobs.accounting(id)) })
    if (parts[3] === "export" && request.method === "GET") {
      if (url.searchParams.get("kind") !== "json") return json({ error: "Only the portable JSON analysis format is available." }, { status: 400 })
      const body = JSON.stringify(await jobs.export(id))
      if (Buffer.byteLength(body) > MAX_ANALYSIS_EXPORT_BYTES) throw new RangeError("Analysis export exceeds its byte limit.")
      return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${id}.analysis.json"`, "Cache-Control": "no-store" } })
    }
    return json({ error: "Not found" }, { status: 404 })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Invalid report request or identifier." }, { status: 400 })
    if (error instanceof RangeError) return json({ error: "Report request exceeds its byte limit." }, { status: 413 })
    if (isMissingFileError(error)) return json({ error: "Report or source artifact not found." }, { status: 404 })
    return json({ error: "Report request could not complete. Check terminal run status and source revisions." }, { status: 409 })
  }
}

function observe(jobs: AnalysisJobs, id: string): void {
  void jobs.start(id).catch(() => console.error("Report persistence failed", { reportId: id }))
}
