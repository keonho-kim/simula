import {
  draftScenario,
  listScenarioSamples,
  parseScenarioDocument,
  readScenarioSample,
  sanitizeSettings,
  type RunStore,
} from "@simula/core"
import type { CreateRunRequest, LLMSettings, SettingsModelsRequest, StoryBuilderDraftRequest } from "@simula/shared"
import { SAMPLE_ROOT } from "./config"
import { streamEvents, type Subscriptions } from "./event-stream"
import { listProviderModels } from "./model-discovery"
import { json, text } from "./responses"
import { startRun } from "./run-controller"
import { readSettings, writeSettings } from "./settings-store"

export interface RouteContext {
  store: RunStore
  subscriptions: Subscriptions
  runningRuns: Set<string>
}

export async function route(context: RouteContext, request: Request, url: URL): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean)
  if (parts[0] !== "api") {
    return json({ error: "Not found" }, { status: 404 })
  }

  if (parts[1] === "settings") {
    return routeSettings(parts, request)
  }

  if (parts[1] === "story-builder" && parts[2] === "draft" && request.method === "POST") {
    try {
      const payload = (await request.json()) as StoryBuilderDraftRequest
      return json(await draftScenario(payload, await readSettings()))
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "StoryBuilder failed." },
        { status: 400 }
      )
    }
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

async function routeSettings(parts: string[], request: Request): Promise<Response> {
  if (parts.length === 2 && request.method === "GET") {
    return json({ settings: sanitizeSettings(await readSettings()) })
  }
  if (parts.length === 2 && request.method === "PUT") {
    const payload = (await request.json()) as { settings: LLMSettings }
    await writeSettings(payload.settings)
    return json({ settings: sanitizeSettings(await readSettings()) })
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
    const manifest = await context.store.createRun(scenario)
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
    return json({
      run: await context.store.readManifest(runId),
      state: await context.store.readState(runId),
      timeline: await context.store.readTimeline(runId),
      events: await context.store.readEvents(runId),
    })
  }
  if (parts[3] === "start" && request.method === "POST") {
    return startRun(context.store, context.subscriptions, context.runningRuns, runId)
  }
  if (parts[3] === "events" && request.method === "GET") {
    return streamEvents(context.store, context.subscriptions, runId)
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

