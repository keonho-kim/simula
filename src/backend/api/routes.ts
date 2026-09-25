/**
 * Purpose: Dispatch API requests to settings, document, scenario, and run boundaries.
 * Pattern: HTTP router.
 * Usage: Called by the shared API handler on the Next custom server.
 * Related: server.ts, src/backend/api/documents/document-controller.ts
 */
import { routeDocuments } from "./documents/document-controller"
import { routeScenarioBuilder } from "./scenario-builder/scenario-builder-controller"
import { routeWorlds } from "./worlds/world-controller"
import { routeMultiverse } from "./multiverse/multiverse-controller"
import { routeAnalysis } from "./analysis/analysis-controller"
import type { AnalysisJobs } from "@/backend/runtime/analysis/jobs"
import type { MultiverseJobs } from "@/backend/runtime/multiverse/jobs"
import { handleStoryBuilder } from "./story-builder/story-builder-controller"
import type { ModelAdmission } from "@/backend/runtime/model-admission"
import type { WorldPreparationJobs } from "@/backend/runtime/worlds/preparation"
import type { ScenarioBuilderJobs } from "@/backend/runtime/scenario-builder/jobs"
import type { DocumentStore } from "@/backend/storage/documents/document-store"
import type { DocumentJobs } from "@/backend/runtime/documents"
import { listScenarioSamples, readScenarioSample } from "@/backend/storage/samples"
import { parseScenarioDocument } from "@/backend/core/scenario"
import { sanitizeSettings } from "@/backend/core/settings/sanitize"
import { type RunStore } from "@/backend/storage/runs/run-store"
import type {
  CreateRunRequest,
  LLMSettings,
  SettingsModelsRequest,
} from "@/shared"
import { SAMPLE_ROOT } from "@/backend/config"
import { streamEvents, streamBoardPreview } from "@/backend/api/runs/event-stream"
import type { Subscriptions } from "@/backend/runtime/events"
import { listProviderModels } from "@/backend/api/settings/model-controller"
import { json, text } from "@/backend/api/responses"
import type { RoundContinuationStore } from "@/backend/runtime/round-continuation"
import { cancelRun, continueRunRound, startRun, startReportCommentary } from "@/backend/api/runs/run-controller"
import { readSettings, writeSettings } from "@/backend/storage/settings-store"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { readBoundedJson } from "./request-json"
import { runPathSegmentSchema } from "@/shared/run-schema"

export interface RouteContext {
  analysisJobs: AnalysisJobs
  multiverseJobs: MultiverseJobs
  modelAdmission: ModelAdmission
  worldJobs: WorldPreparationJobs
  scenarioBuilderJobs: ScenarioBuilderJobs
  documentStore: DocumentStore
  documentJobs: DocumentJobs
  store: RunStore
  subscriptions: Subscriptions
  runningRuns: Set<string>
  roundContinuations: RoundContinuationStore
}

export async function route(context: RouteContext, request: Request, url: URL): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean)
  if (parts[0] !== "api") {
    return json({ error: "Not found" }, { status: 404 })
  }

  if (parts[1] === "documents") return routeDocuments(context.documentStore, context.documentJobs, request, url)
  if (parts[1] === "scenario-builder") return routeScenarioBuilder(context.scenarioBuilderJobs, request, url)
  if (parts[1] === "worlds") return routeWorlds(context.worldJobs, request, url)
  if (parts[1] === "multiverse") return routeMultiverse(context.multiverseJobs, request, url)
  if (parts[1] === "analysis") return routeAnalysis(context.analysisJobs, request, url)

  if (parts[1] === "settings") {
    return routeSettings(parts, request, context.modelAdmission)
  }

  if (parts[1] === "story-builder" && parts[2] === "draft" && request.method === "POST") {
    return handleStoryBuilder(request, parts[3] === "stream", context.modelAdmission)
  }

  if (parts[1] === "scenarios" && parts[2] === "samples") {
    return routeScenarioSamples(parts)
  }

  if (parts[1] === "runs" && parts.length === 2) {
    return routeRuns(context, request)
  }

  const runId = parts[2]
  if (parts[1] === "runs" && runId) {
    return routeRunDetail(context, parts, request, url, runId)
  }

  return json({ error: "Not found" }, { status: 404 })
}

async function routeSettings(parts: string[], request: Request, admission: ModelAdmission): Promise<Response> {
  if (parts[2] === "defaults" && request.method === "GET") {
    const settings = defaultSettings()
    for (const connection of Object.values(settings.providers)) { delete connection.apiKey; delete connection.extraHeaders }
    return json({ settings })
  }
  if (parts.length === 2 && request.method === "GET") {
    return json({ settings: sanitizeSettings(await readSettings()) })
  }
  if (parts.length === 2 && request.method === "PUT") {
    const payload = (await request.json()) as { settings: LLMSettings }
    try {
      await writeSettings(payload.settings)
      const settings = await readSettings()
      admission.setConcurrency(settings.concurrency)
      return json({ settings: sanitizeSettings(settings) })
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Invalid settings." }, { status: 400 })
    }
  }
  if (parts[2] === "models" && request.method === "POST") {
    try {
      const payload = (await request.json()) as SettingsModelsRequest
      return json(await listProviderModels(payload))
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Failed to load models." },
        { status: 400 }
      )
    }
  }
  return json({ error: "Not found" }, { status: 404 })
}

async function routeScenarioSamples(parts: string[]): Promise<Response> {
  if (parts.length === 3) {
    return json({ samples: await listScenarioSamples(SAMPLE_ROOT) })
  }
  if (parts[3]) {
    return json({ sample: await readScenarioSample(SAMPLE_ROOT, decodeURIComponent(parts[3])) })
  }
  return json({ error: "Not found" }, { status: 404 })
}

async function routeRuns(context: RouteContext, request: Request): Promise<Response> {
  if (request.method === "GET") {
    return json({ runs: await context.store.listRuns() })
  }
  if (request.method === "POST") {
    const payload = (await request.json()) as CreateRunRequest | { document: string; sourceName?: string }
    const scenario = "document" in payload
      ? parseScenarioDocument(payload.document, payload.sourceName)
      : payload.scenario
    if (scenario.world) return json({ error: "Create prepared-world runs through the world run endpoint." }, { status: 400 })
    const proposedId = "executionId" in payload ? payload.executionId : undefined
    const parsedId = proposedId === undefined ? undefined : runPathSegmentSchema.safeParse(proposedId)
    if (parsedId && !parsedId.success) return json({ error: "executionId must be a safe run identifier." }, { status: 400 })
    const executionId = parsedId?.data
    const manifest = await context.store.createRun(scenario, { id: executionId })
    return json({ run: manifest }, { status: 201 })
  }
  return json({ error: "Not found" }, { status: 404 })
}

async function routeRunDetail(
  context: RouteContext,
  parts: string[],
  request: Request,
  url: URL,
  runId: string
): Promise<Response> {
  if (parts.length === 3 && request.method === "GET") {
    const stored = await context.store.readState(runId)
    // A persisted running flag without a live local or durable owner indicates interruption.
    const state = stored?.reportCommentary?.status === "running" && !context.runningRuns.has(runId) && !context.store.execution(runId).isActive()
      ? { ...stored, reportCommentary: { ...stored.reportCommentary, status: "partial" as const } } : stored
    return json({
      run: await context.store.readManifest(runId),
      state,
      timeline: await context.store.readTimeline(runId),
      events: await context.store.readEvents(runId),
    })
  }
  if (parts[3] === "commentary" && request.method === "POST") {
    return startReportCommentary(context.store, context.subscriptions, context.runningRuns, context.roundContinuations, runId, context.modelAdmission)
  }
  if (parts[3] === "start" && request.method === "POST") {
    return startRun(context.store, context.subscriptions, context.runningRuns, context.roundContinuations, runId, context.modelAdmission)
  }
  if (parts[3] === "continue" && request.method === "POST") {
    if ((await context.store.readManifest(runId)).batchId) return json({ error: "Approve this world through its batch controls." }, { status: 409 })
    const payload = (await request.json()) as { roundIndex?: number }
    if (!Number.isSafeInteger(payload.roundIndex) || (payload.roundIndex ?? 0) < 1) {
      return json({ error: "roundIndex must be a positive integer." }, { status: 400 })
    }
    return continueRunRound(context.store, context.roundContinuations, runId, payload.roundIndex as number)
  }
  if (parts[3] === "cancel" && request.method === "POST") {
    return cancelRun(context.store, context.runningRuns, context.roundContinuations, runId)
  }
  if (parts[3] === "ack" && request.method === "POST") {
    let payload: unknown
    try { payload = await readBoundedJson(request, 1024) }
    catch { return json({ error: "Invalid acknowledgement body." }, { status: 400 }) }
    if (payload && typeof payload === "object" && !Array.isArray(payload) && "cursor" in payload) {
      if (typeof payload.cursor !== "string") return json({ error: "cursor must identify a run event boundary." }, { status: 400 })
      try {
        const confirmed = context.store.confirmStreamThrough(runId, payload.cursor)
        return confirmed ? json({ status: "pruned" }) : json({ error: "Browser cursor is not a stored event boundary." }, { status: 409 })
      } catch { return json({ error: "Invalid run event cursor." }, { status: 400 }) }
    }
    const count = payload && typeof payload === "object" && !Array.isArray(payload) && "eventCount" in payload ? payload.eventCount : undefined
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      return json({ error: "eventCount must be a nonnegative integer." }, { status: 400 })
    }
    const manifest = await context.store.readManifest(runId)
    if (!["completed", "failed", "canceled"].includes(manifest.status)) return json({ status: "pending" }, { status: 202 })
    if (context.runningRuns.has(runId) || context.store.execution(runId).isActive() || context.subscriptions.get(runId)?.size) {
      return json({ status: "pending" }, { status: 202 })
    }
    const pruned = await context.store.pruneConfirmedEvents(runId, count)
    return pruned ? json({ status: "pruned" }) : json({ error: "Browser event count does not match server history." }, { status: 409 })
  }
  if (parts[3] === "board-preview" && request.method === "GET") {
    const itemId = url.searchParams.get("item")
    if (!itemId) return json({ error: "item is required." }, { status: 400 })
    await context.store.readManifest(runId)
    return streamBoardPreview(context.subscriptions, runId, itemId)
  }
  if (parts[3] === "events" && request.method === "GET") {
    return streamEvents(context.store, context.subscriptions, runId, request.headers.get("Last-Event-ID") ?? url.searchParams.get("after") ?? undefined, request.signal)
  }
  if (parts[3] === "report" && request.method === "GET") {
    return text(await context.store.readReport(runId), "text/markdown")
  }
  if (parts[3] === "export" && request.method === "GET") {
    const kind = url.searchParams.get("kind")
    if (kind !== "json" && kind !== "jsonl" && kind !== "md") {
      return json({ error: "kind must be json, jsonl, or md." }, { status: 400 })
    }
    const exported = await context.store.export(runId, kind)
    return text(exported.body, exported.contentType)
  }
  return json({ error: "Not found" }, { status: 404 })
}
