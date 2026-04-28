import { RunStore } from "@simula/core"
import type { RunEvent } from "@simula/shared"
import { DATA_ROOT, PORT } from "./config"
import { corsHeaders, json } from "./responses"
import { route } from "./routes"

const store = new RunStore({ rootDir: DATA_ROOT })
const subscriptions = new Map<string, Set<(event: RunEvent) => void>>()
const runningRuns = new Set<string>()

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
      const response = await route({ store, subscriptions, runningRuns }, request, url)
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
