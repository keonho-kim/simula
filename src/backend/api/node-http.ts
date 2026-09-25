/**
 * Purpose: Carry existing Fetch API controllers through Next's Node HTTP listener.
 * Pattern: Transport adapter.
 * Usage: Called by server.ts for /api requests and SSE responses.
 * Related: src/backend/api/handle-api-request.ts, server.ts
 */
import type { IncomingMessage, ServerResponse } from "node:http"
import { Readable } from "node:stream"

export function toWebRequest(incoming: IncomingMessage, outgoing: ServerResponse): Request {
  const controller = new AbortController()
  outgoing.once("close", () => controller.abort())
  const method = incoming.method ?? "GET"
  const body = method === "GET" || method === "HEAD" ? undefined : Readable.toWeb(incoming)
  return new Request(requestUrl(incoming), { method, headers: requestHeaders(incoming), body,
    signal: controller.signal, ...(body ? { duplex: "half" as const } : {}) } as RequestInit & { duplex?: "half" })
}

export function toWebUpgradeRequest(incoming: IncomingMessage): Request {
  return new Request(requestUrl(incoming), { method: incoming.method ?? "GET", headers: requestHeaders(incoming) })
}

function requestUrl(incoming: IncomingMessage): URL {
  const protocol = "encrypted" in incoming.socket && incoming.socket.encrypted ? "https" : "http"
  return new URL(incoming.url ?? "/", `${protocol}://${incoming.headers.host ?? "localhost"}`)
}

function requestHeaders(incoming: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) value.forEach(part => headers.append(key, part))
    else if (value !== undefined) headers.set(key, value)
  }
  return headers
}

export async function writeWebResponse(outgoing: ServerResponse, response: Response): Promise<void> {
  outgoing.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key !== "set-cookie") outgoing.setHeader(key, value)
  })
  const cookies = response.headers.getSetCookie()
  if (cookies.length) outgoing.setHeader("Set-Cookie", cookies)
  if (!response.body || outgoing.req.method === "HEAD") { outgoing.end(); return }

  const reader = response.body.getReader()
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  outgoing.once("close", cancel)
  try {
    while (!outgoing.destroyed) {
      const { value, done } = await reader.read()
      if (done) break
      if (!outgoing.write(value)) await waitForDrain(outgoing)
    }
    if (!outgoing.destroyed) outgoing.end()
  } catch (error) {
    if (!outgoing.destroyed) outgoing.destroy(error instanceof Error ? error : new Error("Response stream failed."))
  } finally {
    outgoing.off("close", cancel)
    reader.releaseLock()
  }
}

function waitForDrain(outgoing: ServerResponse): Promise<void> {
  return new Promise(resolve => {
    const finish = () => { outgoing.off("drain", finish); outgoing.off("close", finish); resolve() }
    outgoing.once("drain", finish)
    outgoing.once("close", finish)
  })
}
