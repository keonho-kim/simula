import { join } from "node:path"
import { serveWebAsset } from "@/backend/api/web-assets"
import { RunStore } from "@/backend/storage/runs/run-store"
import { Subscriptions } from "@/backend/runtime/events"
import { DATA_ROOT, PORT, SERVE_WEB, WEB_ROOT } from "@/backend/config"
import { corsHeaders, json } from "@/backend/api/responses"
import { RoundContinuationStore } from "@/backend/runtime/round-continuation"
import { route } from "@/backend/api/routes"

const store = new RunStore({ rootDir: DATA_ROOT })
const subscriptions = new Subscriptions()
const runningRuns = new Set<string>()
const roundContinuations = new RoundContinuationStore()
const streamCancelTimers = new Map<string, ReturnType<typeof setTimeout>>()

if (SERVE_WEB && !await Bun.file(join(WEB_ROOT, "index.html")).exists()) {
  throw new Error("Web build is missing. Run bun run build before bun run start.")
}
await store.ensureRoot()

const server = Bun.serve({
  port: PORT,
  idleTimeout: 0,
  async fetch(request) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders() })
      }
      const url = new URL(request.url)
      if (SERVE_WEB && url.pathname !== "/api" && !url.pathname.startsWith("/api/")) {
        return serveWebAsset(request, WEB_ROOT)
      }
      const response = await route({
        store,
        subscriptions,
        runningRuns,
        roundContinuations,
        onRunStreamSubscribe: clearStreamCancelTimer,
        onRunStreamEmpty: scheduleStreamCancel,
      }, request, url)
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

function clearStreamCancelTimer(runId: string): void {
  const timer = streamCancelTimers.get(runId)
  if (timer) {
    clearTimeout(timer)
    streamCancelTimers.delete(runId)
  }
}

function scheduleStreamCancel(runId: string): void {
  clearStreamCancelTimer(runId)
  if (!runningRuns.has(runId)) {
    return
  }
  const timer = setTimeout(() => {
    streamCancelTimers.delete(runId)
    if (runningRuns.has(runId) && !subscriptions.has(runId)) {
      roundContinuations.cancel(runId)
    }
  }, 30_000)
  streamCancelTimers.set(runId, timer)
}
