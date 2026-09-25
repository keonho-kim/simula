/**
 * Purpose: Restrict temporary server artifacts to the browser session that created them.
 * Pattern: HTTP ownership gate.
 * Usage: Wraps the API router on the single Next custom server.
 * Related: src/backend/runtime/browser-sessions.ts, src/backend/api/routes.ts
 */
import type { BrowserResourceKind, BrowserSessions } from "@/backend/runtime/browser-sessions"
import { withSettingsSession } from "@/backend/storage/settings-store"
import { json } from "./responses"
import { route, type RouteContext } from "./routes"

const RESOURCE_KINDS: Record<string, BrowserResourceKind> = {
  documents: "document-set", "scenario-builder": "build", worlds: "world", multiverse: "batch",
  analysis: "analysis", runs: "run",
}

export async function routeBrowserSession(
  context: RouteContext, sessions: BrowserSessions, sessionId: string, request: Request, url: URL
): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean)
  const kind = RESOURCE_KINDS[parts[1] ?? ""]
  if (kind && parts[2] && !sessions.owns(sessionId, kind, parts[2])) {
    return json({ error: "This browser session does not own the requested work." }, { status: 404 })
  }
  if (kind && parts.length === 2 && request.method === "POST") {
    const id = request.headers.get("idempotency-key")
    if (id && sessions.hasOwner(kind, id) && !sessions.owns(sessionId, kind, id)) {
      return json({ error: "This work belongs to another browser session." }, { status: 409 })
    }
    if (!await ownsSource(sessions, sessionId, kind, request)) {
      return json({ error: "The source belongs to another browser session." }, { status: 404 })
    }
  }
  if (kind === "analysis" && request.method === "GET" && parts.length === 2) {
    const sourceKind = url.searchParams.get("kind") === "batch" ? "batch" : "run"
    const sourceId = url.searchParams.get("subject")
    if (sourceId && !sessions.owns(sessionId, sourceKind, sourceId)) {
      return json({ error: "The source belongs to another browser session." }, { status: 404 })
    }
  }
  const response = await withSettingsSession(sessionId, () => route(context, request, url))
  if (!response.ok) return response
  if (kind === "batch" && (parts[2] || request.method === "POST")) {
    const body = await response.clone().json().catch(() => null) as { batch?: { worlds?: Array<{ runId?: string }> } } | null
    for (const world of body?.batch?.worlds ?? []) {
      if ("id" in world && typeof world.id === "string") sessions.attach(sessionId, "world", world.id)
      if (world.runId) sessions.attach(sessionId, "run", world.runId)
    }
  }
  if (kind === "run" && parts.length === 2 && request.method === "GET") {
    const body = await response.json() as { runs: Array<{ id: string }> }
    const owned = sessions.ownedIds(sessionId, "run")
    return json({ runs: body.runs.filter(run => owned.has(run.id)) })
  }
  if (kind && request.method === "POST") {
    const body = await response.clone().json().catch(() => null) as Record<string, unknown> | null
    const created = body?.[kind === "document-set" ? "documentSet" : kind]
    if (created && typeof created === "object" && "id" in created && typeof created.id === "string") {
      sessions.attach(sessionId, kind, created.id)
    }
    if (kind === "world" && parts[3] === "run" && body?.run && typeof body.run === "object" && "id" in body.run && typeof body.run.id === "string") {
      sessions.attach(sessionId, "run", body.run.id)
    }
  }
  return response
}

async function ownsSource(sessions: BrowserSessions, sessionId: string, kind: BrowserResourceKind, request: Request): Promise<boolean> {
  if (kind === "document-set" || kind === "run") return true
  const body = await request.clone().json().catch(() => null) as Record<string, unknown> | null
  if (!body) return true // The controller reports malformed input.
  if (kind === "build") return typeof body.documentSetId !== "string" || sessions.owns(sessionId, "document-set", body.documentSetId)
  if (kind === "world" || kind === "batch") return typeof body.scenarioId !== "string" || sessions.owns(sessionId, "build", body.scenarioId)
  if (kind === "analysis" && body.subject && typeof body.subject === "object" && "id" in body.subject && "kind" in body.subject) {
    const source = body.subject as { id: unknown; kind: unknown }
    return typeof source.id !== "string" || sessions.owns(sessionId, source.kind === "batch" ? "batch" : "run", source.id)
  }
  return true
}
