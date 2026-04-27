import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import {
  RunStore,
  defaultSettings,
  draftScenario,
  listScenarioSamples,
  normalizeSettings,
  parseScenarioDocument,
  readScenarioSample,
  runSimulation,
  sanitizeSettings,
} from "@simula/core"
import type {
  CreateRunRequest,
  LLMSettings,
  RunEvent,
  RunManifest,
  ScenarioInput,
  StoryBuilderDraftRequest,
} from "@simula/shared"

const PORT = Number(process.env.PORT ?? 3001)
const DATA_ROOT = process.env.SIMULA_DATA_DIR ?? join(process.cwd(), "runs")
const SETTINGS_PATH = process.env.SIMULA_SETTINGS_PATH ?? join(process.cwd(), "settings.json")
const SAMPLE_ROOT = process.env.SIMULA_SAMPLE_DIR ?? join(import.meta.dirname, "../../..", "senario.samples")

const store = new RunStore({ rootDir: DATA_ROOT })
const subscriptions = new Map<string, Set<(event: RunEvent) => void>>()
const runningRuns = new Set<string>()

await store.ensureRoot()

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders() })
      }
      const url = new URL(request.url)
      const response = await route(request, url)
      for (const [key, value] of Object.entries(corsHeaders())) {
        response.headers.set(key, value)
      }
      return response
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Unexpected server error." },
        { status: 500 }
      )
    }
  },
})

console.log(`Simula server listening on http://localhost:${server.port}`)

async function route(request: Request, url: URL): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean)
  if (parts[0] !== "api") {
    return json({ error: "Not found" }, { status: 404 })
  }

  if (parts[1] === "settings") {
    if (request.method === "GET") {
      return json({ settings: sanitizeSettings(await readSettings()) })
    }
    if (request.method === "PUT") {
      const payload = (await request.json()) as { settings: LLMSettings }
      await writeSettings(payload.settings)
      return json({ settings: sanitizeSettings(payload.settings) })
    }
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
    if (parts.length === 3 && request.method === "GET") {
      return json({ samples: await listScenarioSamples(SAMPLE_ROOT) })
    }
    if (parts[3] && request.method === "GET") {
      return json({ sample: await readScenarioSample(SAMPLE_ROOT, decodeURIComponent(parts[3])) })
    }
  }

  if (parts[1] === "runs" && parts.length === 2) {
    if (request.method === "GET") {
      return json({ runs: await store.listRuns() })
    }
    if (request.method === "POST") {
      const payload = (await request.json()) as CreateRunRequest | { document: string; sourceName?: string }
      const scenario = "document" in payload
        ? parseScenarioDocument(payload.document, payload.sourceName)
        : payload.scenario
      const manifest = await store.createRun(scenario)
      return json({ run: manifest }, { status: 201 })
    }
  }

  const runId = parts[2]
  if (parts[1] === "runs" && runId) {
    if (parts.length === 3 && request.method === "GET") {
      return json({
        run: await store.readManifest(runId),
        state: await store.readState(runId),
        timeline: await store.readTimeline(runId),
      })
    }
    if (parts[3] === "start" && request.method === "POST") {
      return startRun(runId)
    }
    if (parts[3] === "events" && request.method === "GET") {
      return streamEvents(runId)
    }
    if (parts[3] === "report" && request.method === "GET") {
      return text(await store.readReport(runId), "text/markdown")
    }
    if (parts[3] === "export" && request.method === "GET") {
      const kind = url.searchParams.get("kind")
      if (kind !== "json" && kind !== "jsonl" && kind !== "md") {
        return json({ error: "kind must be json, jsonl, or md." }, { status: 400 })
      }
      const exported = await store.export(runId, kind)
      return text(exported.body, exported.contentType)
    }
  }

  return json({ error: "Not found" }, { status: 404 })
}

async function startRun(runId: string): Promise<Response> {
  if (runningRuns.has(runId)) {
    return json({ status: "already_running" }, { status: 202 })
  }
  const manifest = await store.readManifest(runId)
  const scenario = await store.readScenario(runId)
  const settings = await readSettings()
  runningRuns.add(runId)
  void executeRun(manifest, scenario, settings)
  return json({ status: "started" }, { status: 202 })
}

async function executeRun(
  manifest: RunManifest,
  scenario: ScenarioInput,
  settings: LLMSettings
): Promise<void> {
  const startedAt = new Date().toISOString()
  await store.writeManifest({ ...manifest, status: "running", startedAt })
  try {
    const finalState = await runSimulation({
      runId: manifest.id,
      scenario,
      settings,
      emit: (event) => appendAndPublish(event),
    })
    await store.writeState(finalState)
    await store.writeManifest({
      ...manifest,
      status: "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      stopReason: finalState.stopReason,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Run failed."
    await appendAndPublish({
      type: "run.failed",
      runId: manifest.id,
      timestamp: new Date().toISOString(),
      error: message,
    })
    await store.writeManifest({
      ...manifest,
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      stopReason: "failed",
      error: message,
    })
  } finally {
    runningRuns.delete(manifest.id)
  }
}

async function appendAndPublish(event: RunEvent): Promise<void> {
  const frame = await store.appendEvent(event)
  publish(event.runId, event)
  if (frame && event.type !== "graph.delta") {
    const graphEvent: RunEvent = {
      type: "graph.delta",
      runId: event.runId,
      timestamp: frame.timestamp,
      frame,
    }
    await store.appendEvent(graphEvent)
    publish(event.runId, graphEvent)
  }
}

function streamEvents(runId: string): Response {
  const encoder = new TextEncoder()
  let send: ((event: RunEvent) => void) | undefined
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      send = (event: RunEvent) => controller.enqueue(encoder.encode(formatSse(event)))
      const existing = await store.readEvents(runId).catch(() => [])
      for (const event of existing) {
        send(event)
      }
      const set = subscriptions.get(runId) ?? new Set<(event: RunEvent) => void>()
      set.add(send)
      subscriptions.set(runId, set)
      controller.enqueue(encoder.encode(": connected\n\n"))
    },
    cancel() {
      const set = subscriptions.get(runId)
      if (!set || !send) {
        return
      }
      set.delete(send)
      if (set.size === 0) {
        subscriptions.delete(runId)
      }
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

function publish(runId: string, event: RunEvent): void {
  const set = subscriptions.get(runId)
  if (!set) {
    return
  }
  for (const subscriber of set) {
    subscriber(event)
  }
}

async function readSettings(): Promise<LLMSettings> {
  try {
    return normalizeSettings(JSON.parse(await readFile(SETTINGS_PATH, "utf8")) as Partial<LLMSettings>)
  } catch {
    return defaultSettings()
  }
}

async function writeSettings(settings: LLMSettings): Promise<void> {
  const normalized = normalizeSettings(settings)
  await mkdir(dirname(SETTINGS_PATH), { recursive: true }).catch(() => undefined)
  await writeFile(SETTINGS_PATH, `${JSON.stringify(normalized, null, 2)}\n`, "utf8")
}

function formatSse(event: RunEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
}

function text(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
    },
  })
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}
