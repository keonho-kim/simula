/**
 * Purpose: Verify closure sharing never unions differing private knowledge or conflates evidence.
 * Pattern: Pure grouping contract tests.
 * Usage: bun test src/backend/core/simulation/actors/memory-closure-groups.test.ts
 * Related: src/backend/core/simulation/actors/memory-closure-groups.ts
 */
import { expect, test } from "bun:test"
import { buildActor } from "../roles/generator/state"
import { applyMemoryUpdate, parseMemoryUpdate } from "./memory-records"
import { groupMemoryClosures } from "./memory-closure-groups"

function reader(index: number, origin = "promise") {
  const actor = buildActor(index, { name: `Reader ${index}`, role: "Reviewer", backgroundHistory: "Review", personality: "Careful", preference: "Clarity" }, "Review", {})
  const previous = { id: `${origin}:${actor.id}`, interactionId: origin, kind: "in" as const,
    sourceActorId: "finance", roundIndex: 1, content: "I will send the budget." }
  const update = parseMemoryUpdate({ additions: [{ kind: "commitment", quote: "I will send the budget." }], closures: [] }, previous, [])
  actor.context = { visible: [previous], ledger: applyMemoryUpdate(undefined, previous, update, actor.id) }
  const entry = { ...previous, id: `delivered:${actor.id}`, interactionId: "delivered", roundIndex: 2, content: "I sent the budget." }
  return { actor, entry }
}

test("identical known records share one closure input with reader-local ID mappings", () => {
  const readers = [reader(1), reader(2)]
  const groups = groupMemoryClosures(readers)
  expect(groups).toHaveLength(1)
  expect(groups[0]?.records[0]?.id).toBe("R1")
  expect(groups[0]?.readers.map(reader => reader.recordIds)).toEqual([["actor-1:memory:1"], ["actor-2:memory:1"]])
  expect(readers[0]?.actor.context.ledger?.records[0]?.id).toBe("actor-1:memory:1")
})

test("different private evidence and differing present content never share a closure packet", () => {
  const first = reader(1)
  const second = reader(2, "separate-private-promise")
  expect(groupMemoryClosures([first, second])).toHaveLength(2)
  const sameHistory = reader(3)
  sameHistory.entry.content = "I might send the budget."
  expect(groupMemoryClosures([first, sameHistory])).toHaveLength(2)
  const outsider = reader(4)
  outsider.actor.context.ledger = undefined
  expect(groupMemoryClosures([first, outsider])).toHaveLength(2)
})
