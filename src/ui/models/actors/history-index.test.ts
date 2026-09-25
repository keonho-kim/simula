/**
 * Purpose: Verify virtual history indices preserve round and message order without flattening messages.
 * Pattern: Pure mapping contract test.
 * Usage: bun test src/ui/models/actors/history-index.test.ts
 * Related: src/ui/models/actors/history-index.ts, src/ui/components/actors/history/window-history.tsx
 */
import { expect, test } from "bun:test"
import type { ActorRound } from "./actor-conversation"
import { buildHistoryIndex, historyRowAt } from "./history-index"

test("indexes headers and messages across empty and populated rounds", () => {
  const rounds: ActorRound[] = [
    { roundIndex: 1, messages: [] },
    { roundIndex: 2, messages: [
      { id: "first", actorId: "a", actorName: "A", role: "", targets: [], thought: "", action: "", content: "One", decisionType: "action", timestamp: "" },
      { id: "second", actorId: "b", actorName: "B", role: "", targets: [], thought: "", action: "", content: "Two", decisionType: "action", timestamp: "" },
    ] },
  ]
  const index = buildHistoryIndex(rounds)
  expect(index.count).toBe(4)
  expect(Array.from({ length: index.count }, (_, position) => historyRowAt(index, position)?.key))
    .toEqual(["round:1", "round:2", "message:first", "message:second"])
  expect(historyRowAt(index, 4)).toBeUndefined()
})
