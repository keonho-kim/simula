/**
 * Purpose: Stop active server work when its browser owner has disconnected.
 * Pattern: Process-scoped session lease.
 * Usage: Created by the backend runtime composition for API ownership and presence streaming.
 * Related: server.ts, src/ui/browser-storage/browser-presence.ts
 */
const EXPIRY_MS = 30_000

export type BrowserResourceKind = "run" | "build" | "world" | "batch" | "analysis" | "document-set"
export interface BrowserResource { kind: BrowserResourceKind; id: string }
interface Session { id: string; lastSeen: number; connections: number; resources: BrowserResource[] }

export class BrowserSessions {
  private readonly sessions = new Map<string, Session>()
  private readonly owners = new Map<string, string>()
  private readonly timer: ReturnType<typeof setInterval>

  constructor(private readonly cancel: (resource: BrowserResource) => void | Promise<void>, private readonly now = Date.now,
    private readonly onExpire: (sessionId: string) => void = () => undefined) {
    this.timer = setInterval(() => this.expireIdle(), 5_000)
  }

  resolve(cookie: string | null): { session: Session; created: boolean } {
    const id = cookie?.split(";").map(value => value.trim()).find(value => value.startsWith("simula-session="))?.slice("simula-session=".length)
    const existing = id && this.sessions.get(id)
    if (existing) { existing.lastSeen = this.now(); return { session: existing, created: false } }
    const session: Session = { id: crypto.randomUUID(), lastSeen: this.now(), connections: 0, resources: [] }
    this.sessions.set(session.id, session)
    return { session, created: true }
  }

  attach(sessionId: string, kind: BrowserResourceKind, id: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error("Browser session expired.")
    const key = `${kind}:${id}`
    const owner = this.owners.get(key)
    if (owner && owner !== sessionId) throw new Error("Execution belongs to another browser session.")
    if (owner) return
    this.owners.set(key, sessionId)
    session.resources.push({ kind, id })
  }

  owns(sessionId: string, kind: BrowserResourceKind, id: string): boolean {
    return this.owners.get(`${kind}:${id}`) === sessionId
  }

  hasOwner(kind: BrowserResourceKind, id: string): boolean {
    return this.owners.has(`${kind}:${id}`)
  }

  ownedIds(sessionId: string, kind: BrowserResourceKind): Set<string> {
    return new Set(this.sessions.get(sessionId)?.resources.filter(resource => resource.kind === kind).map(resource => resource.id) ?? [])
  }

  connect(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    session.connections++
    session.lastSeen = this.now()
    return true
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.connections = Math.max(0, session.connections - 1)
    session.lastSeen = this.now()
  }

  close(): void { clearInterval(this.timer) }

  expireIdle(): void {
    for (const [id, session] of this.sessions) {
      if (session.connections || this.now() - session.lastSeen <= EXPIRY_MS) continue
      this.sessions.delete(id)
      this.onExpire(id)
      for (const resource of session.resources) this.owners.delete(`${resource.kind}:${resource.id}`)
      void (async () => {
        // Reverse creation order keeps dependent analysis and runs from reading deleted source files.
        for (const resource of [...session.resources].reverse()) {
          try { await this.cancel(resource) }
          catch { /* The remaining resources still need cleanup after one cancellation failure. */ }
        }
      })()
    }
  }
}
