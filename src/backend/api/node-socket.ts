/**
 * Purpose: Preserve browser presence sockets on the single Next HTTP listener.
 * Pattern: WebSocket transport adapter.
 * Usage: Attached by server.ts before accepting HTTP requests.
 * Related: src/backend/runtime/browser-sessions.ts, src/backend/api/session-request.ts
 */
import type { IncomingMessage, Server as HttpServer } from "node:http"
import type { Duplex } from "node:stream"
import { WebSocketServer, WebSocket } from "ws"
import type { BrowserSessions } from "@/backend/runtime/browser-sessions"
import { resolveBrowserSession, sameOriginRequest } from "./session-request"
import { toWebUpgradeRequest } from "./node-http"

const PRESENCE_PATH = "/api/browser-session/socket"
const PING_INTERVAL_MS = 15_000

interface SocketSession { sessionId: string; cookie?: string; replaced: boolean }

export function attachBrowserSockets(server: HttpServer, sessions: BrowserSessions,
  nextUpgrade: (request: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void>): () => Promise<void> {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 64, perMessageDeflate: false })
  const handshake = new WeakMap<IncomingMessage, SocketSession>()
  sockets.on("headers", (headers, request) => {
    const cookie = handshake.get(request)?.cookie
    if (cookie) headers.push(`Set-Cookie: ${cookie}`)
  })
  sockets.on("connection", (socket, request) => {
    const details = handshake.get(request)
    handshake.delete(request)
    if (!details || !sessions.connect(details.sessionId)) { socket.close(1008, "Session expired"); return }
    if (details.replaced) socket.send("replaced")
    socket.on("message", () => socket.send("alive"))
    socket.on("close", () => sessions.disconnect(details.sessionId))
  })
  const ping = setInterval(() => {
    for (const socket of sockets.clients) if (socket.readyState === WebSocket.OPEN) socket.ping()
  }, PING_INTERVAL_MS)
  server.on("upgrade", (incoming, socket, head) => {
    if (new URL(incoming.url ?? "/", "http://localhost").pathname !== PRESENCE_PATH) {
      void nextUpgrade(incoming, socket, head).catch(() => socket.destroy())
      return
    }
    const request = toWebUpgradeRequest(incoming)
    if (incoming.method !== "GET" || !sameOriginRequest(request)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n")
      return
    }
    handshake.set(incoming, resolveBrowserSession(sessions, request))
    sockets.handleUpgrade(incoming, socket, head, upgraded => sockets.emit("connection", upgraded, incoming))
  })
  return async () => {
    clearInterval(ping)
    for (const socket of sockets.clients) socket.terminate()
    await new Promise<void>(resolve => sockets.close(() => resolve()))
  }
}
