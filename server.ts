/**
 * Purpose: Serve Next pages and the existing simulation API from one process-owned listener.
 * Pattern: Composition Root with transport adapters.
 * Usage: Started by bun run dev or bun run start after the Next build.
 * Related: src/backend/runtime/composition.ts, src/backend/api/node-http.ts
 */
import next from "next"
import { createServer as createHttpServer } from "node:http"
import { createServer as createHttpsServer } from "node:https"
import { readFileSync } from "node:fs"
import type { Socket } from "node:net"
import { PORT, TLS_CERT_FILE, TLS_KEY_FILE } from "@/backend/config"
import { createBackendRuntime } from "@/backend/runtime/composition"
import { handleApiRequest } from "@/backend/api/handle-api-request"
import { toWebRequest, writeWebResponse } from "@/backend/api/node-http"
import { attachBrowserSockets } from "@/backend/api/node-socket"
import { json } from "@/backend/api/responses"

const development = process.env.NODE_ENV !== "production"
const nextApp = next({ dev: development, hostname: "localhost", port: PORT, webpack: true })
await nextApp.prepare()
const runtime = await createBackendRuntime()
const nextHandler = nextApp.getRequestHandler()

const handleRequest = async (incoming: import("node:http").IncomingMessage,
  outgoing: import("node:http").ServerResponse) => {
  // OPFS workers and the application share one isolated origin in both modes.
  outgoing.setHeader("Cross-Origin-Opener-Policy", "same-origin")
  outgoing.setHeader("Cross-Origin-Embedder-Policy", "require-corp")
  outgoing.setHeader("Cross-Origin-Resource-Policy", "same-origin")
  try {
    if (new URL(incoming.url ?? "/", "http://localhost").pathname.startsWith("/api/")) {
      const request = toWebRequest(incoming, outgoing)
      await writeWebResponse(outgoing, await handleApiRequest(runtime.routes, runtime.sessions, request))
      return
    }
    await nextHandler(incoming, outgoing)
  } catch (error) {
    if (outgoing.headersSent) { outgoing.destroy(error instanceof Error ? error : undefined); return }
    await writeWebResponse(outgoing, json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 }))
  }
}

const server = TLS_CERT_FILE && TLS_KEY_FILE
  ? createHttpsServer({ cert: readFileSync(TLS_CERT_FILE), key: readFileSync(TLS_KEY_FILE) },
    (incoming, outgoing) => { void handleRequest(incoming, outgoing) })
  : createHttpServer((incoming, outgoing) => { void handleRequest(incoming, outgoing) })
const connections = new Set<Socket>()
server.on("connection", socket => {
  connections.add(socket)
  socket.on("close", () => connections.delete(socket))
})
const closeSockets = attachBrowserSockets(server, runtime.sessions, nextApp.getUpgradeHandler())
server.listen(PORT, "0.0.0.0")

let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  const closed = new Promise<void>(resolve => server.close(() => resolve()))
  server.closeAllConnections()
  await closeSockets()
  for (const socket of connections) socket.destroy()
  await nextApp.close()
  await closed
  await runtime.close()
}
const shutdown = () => { void stop().then(() => process.exit(0), error => {
  console.error(error)
  process.exit(1)
}) }
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

console.log(`Simula listening on ${TLS_CERT_FILE ? "https" : "http"}://localhost:${PORT}`)
