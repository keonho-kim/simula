/**
 * Purpose: Verify preview arrival order, confirmation replacement, and terminal cleanup.
 * Pattern: Pure projection test.
 * Usage: bun test src/ui/models/actors/live-conversation.test.ts
 * Related: src/ui/models/actors/live-conversation.ts
 */
import { expect, test } from "bun:test"
import { reconcileLiveConversation } from "./live-conversation"
import type { ActorRound } from "./actor-conversation"
import type { ActorProgressSnapshot } from "@/shared/actor-progress"
const preview: ActorProgressSnapshot = { runId: "r", streamId: "s", revision: 1, roundIndex: 1, status: "running", parallel: true,
  turns: [{ actorId: "b", actorName: "B", status: "ready", timestamp: "now", order: 0, message: {
    id: "round-1-b", actorId: "b", actorName: "B", role: "Role", content: "B: Hello", action: "Speak", targets: [], visibility: "public", decisionType: "action",
  } }] }
test("ready preview is visible and confirmation replaces it without reordering", () => {
  const first = reconcileLiveConversation([], [], preview)
  expect(first[0].messages[0].delivery).toBe("pending")
  const b = { ...first[0].messages[0], content: "Confirmed", delivery: undefined }
  const a = { ...b, id: "round-1-a", actorId: "a", actorName: "A" }
  const accepted: ActorRound[] = [{ roundIndex: 1, messages: [a, b] }]
  const next = reconcileLiveConversation(first, accepted, preview)
  expect(next[0].messages.map(message => message.actorId)).toEqual(["b", "a"])
  expect(next[0].messages[0].content).toBe("Confirmed")
  expect(next[0].messages[0].delivery).toBeUndefined()
  expect(reconcileLiveConversation(next, accepted, preview)).toBe(next)
})
test("failure marks only unconfirmed previews and saved history ignores them", () => {
  const failed = reconcileLiveConversation([], [], { ...preview, status: "failed" })
  expect(failed[0].messages[0].delivery).toBe("unapplied")
  expect(reconcileLiveConversation([], [], undefined)).toEqual([])
})

test("an unchanged historical round is not traversed when only current previews change", () => {
  const source: ActorRound[] = [{ roundIndex: 0, messages: [] }]
  const first = reconcileLiveConversation([], source, preview)
  const changed = reconcileLiveConversation(first, source, { ...preview, revision: 2 })
  expect(changed[0]).toBe(first[0])
})

test("a newer round preview cannot remove an earlier card while confirmed delivery catches up", () => {
  const first = reconcileLiveConversation([], [], preview)
  const nextRound = { ...preview, revision: 2, roundIndex: 2, turns: [] }
  const next = reconcileLiveConversation(first, [], nextRound)
  expect(next[0].messages[0]).toBe(first[0].messages[0])
  const canceled = reconcileLiveConversation(next, [], { ...nextRound, status: "canceled" })
  expect(canceled[0].messages[0].delivery).toBe("unapplied")
})
