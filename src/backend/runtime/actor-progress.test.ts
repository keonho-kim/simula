/**
 * Purpose: Verify bounded transient actor progress and authoritative confirmation handling.
 * Pattern: Runtime contract test.
 * Usage: bun test src/backend/runtime/actor-progress.test.ts
 * Related: src/backend/runtime/actor-progress.ts, src/shared/actor-progress.ts
 */
import { expect, test } from "bun:test"
import { ActorProgress } from "./actor-progress"
import { parseActorProgress } from "@/shared/actor-progress"

const base = { runId: "run", timestamp: "now" }
const ready = (actorId: string) => ({ type: "actor.progress" as const, ...base, update: { kind: "ready" as const, roundIndex: 1,
  message: { id: `round-1-${actorId}`, actorId, actorName: actorId, role: "Role", targets: [], content: "Hello", action: "Speak", visibility: "public" as const, decisionType: "action" as const } } })
test("later actor can be ready before earlier actor, with no durable interaction", () => {
  const progress = new ActorProgress()
  progress.publish({ type: "actor.progress", ...base, update: { kind: "round", roundIndex: 1, parallel: true, actors: [{ id: "a", name: "A" }, { id: "b", name: "B" }] } })
  progress.publish(ready("b"))
  const snapshot = progress.snapshot("run")!
  expect(snapshot.turns[0].status).toBe("waiting")
  expect(snapshot.turns[1].message?.content).toBe("Hello")
  expect(snapshot.turns[1].order).toBe(0)
  expect(parseActorProgress(snapshot, "run")).toEqual(snapshot)
  expect(() => parseActorProgress(snapshot, "other")).toThrow()
})
test("canceling ends previews and rejects late results", () => {
  const progress = new ActorProgress()
  progress.publish({ type: "actor.progress", ...base, update: { kind: "round", roundIndex: 1, parallel: false, actors: [{ id: "a", name: "A" }] } })
  progress.publish(ready("a"))
  const received: string[] = []
  const unsubscribe = progress.subscribe("run", state => received.push(state.status))
  progress.publish({ type: "run.canceled", ...base })
  progress.publish(ready("a"))
  expect(received).toEqual(["running", "canceled"])
  expect(progress.snapshot("run")).toBeUndefined()
  unsubscribe()
  expect(progress.subscriberCount("run")).toBe(0)
})
