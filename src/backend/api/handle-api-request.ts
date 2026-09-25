/**
 * Purpose: Route one browser-scoped API request without owning the HTTP listener.
 * Pattern: HTTP adapter.
 * Usage: Called by the Next custom server entry point.
 * Related: src/backend/api/browser-session-gate.ts, src/backend/api/session-request.ts
 */
import type { BrowserSessions } from "@/backend/runtime/browser-sessions"
import type { RouteContext } from "@/backend/api/routes"
import { routeBrowserSession } from "@/backend/api/browser-session-gate"
import { json } from "@/backend/api/responses"
import { resolveBrowserSession, sameOriginRequest } from "./session-request"

export async function handleApiRequest(context: RouteContext, sessions: BrowserSessions, request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 405, headers: { Allow: "GET, POST, PUT" } })
  if (!sameOriginRequest(request)) return json({ error: "Cross-origin API requests are not allowed." }, { status: 403 })
  const { sessionId, cookie, replaced } = resolveBrowserSession(sessions, request)
  const response = await routeBrowserSession(context, sessions, sessionId, request, new URL(request.url))
  if (cookie) response.headers.set("Set-Cookie", cookie)
  if (replaced) response.headers.set("X-Simula-Session-Replaced", "1")
  return response
}
