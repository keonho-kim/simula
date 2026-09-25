/**
 * Purpose: Verify session ownership and grace-period cancellation.
 * Pattern: Behavioral contract test.
 * Usage: bun test src/backend/runtime/browser-sessions.test.ts
 * Related: src/backend/runtime/browser-sessions.ts
 */
import { describe, expect, test } from "bun:test"
import { BrowserSessions } from "./browser-sessions"

describe("browser sessions", () => {
  test("expires disconnected work after 30 seconds and keeps sessions isolated", async () => {
    let clock = 100
    const canceled: string[] = []
    const forgotten: string[] = []
    const sessions = new BrowserSessions(resource => { canceled.push(`${resource.kind}:${resource.id}`) },
      () => clock, id => { forgotten.push(id) })
    try {
      const first = sessions.resolve(null).session
      const second = sessions.resolve(null).session
      sessions.attach(first.id, "run", "run-a")
      sessions.attach(second.id, "run", "run-b")
      expect(sessions.owns(first.id, "run", "run-b")).toBe(false)
      expect(() => sessions.attach(second.id, "run", "run-a")).toThrow()
      clock += 29_999
      sessions.expireIdle()
      expect(canceled).toEqual([])
      clock += 2
      sessions.expireIdle()
      await Promise.resolve()
      expect(canceled).toEqual(["run:run-a", "run:run-b"])
      expect(forgotten).toContain(first.id)
    } finally { sessions.close() }
  })

  test("an open browser socket prevents expiry until it closes", () => {
    let clock = 0
    const canceled: string[] = []
    const sessions = new BrowserSessions(resource => { canceled.push(resource.id) }, () => clock)
    try {
      const session = sessions.resolve(null).session
      sessions.attach(session.id, "run", "run-a")
      sessions.connect(session.id)
      clock = 31_000
      sessions.expireIdle()
      expect(canceled).toEqual([])
      sessions.disconnect(session.id)
      sessions.expireIdle()
      expect(canceled).toEqual([])
    } finally { sessions.close() }
  })
})
