/**
 * Purpose: Apply same-origin and browser-session rules to HTTP and socket handshakes.
 * Pattern: Transport boundary adapter.
 * Usage: Called by both server entry points before routing API requests.
 * Related: src/backend/runtime/browser-sessions.ts, src/backend/api/browser-session-gate.ts
 */
import type { BrowserSessions } from "@/backend/runtime/browser-sessions"

export function sameOriginRequest(request: Request): boolean {
  const site = request.headers.get("Sec-Fetch-Site")
  return !site || site === "same-origin" || site === "none"
}

export function resolveBrowserSession(sessions: BrowserSessions, request: Request) {
  const { session, created } = sessions.resolve(request.headers.get("cookie"))
  const secure = new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production"
  const cookie = created ? `simula-session=${session.id}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}` : undefined
  const replaced = created && Boolean(request.headers.get("cookie")?.includes("simula-session="))
  return { sessionId: session.id, cookie, replaced }
}
