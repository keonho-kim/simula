/**
 * Purpose: Verify source-linked memory survives summary loss and changes only with visible evidence.
 * Pattern: Memory reducer contract tests.
 * Usage: bun test src/backend/core/simulation/actors/memory-records.test.ts
 * Related: src/backend/core/simulation/actors/memory-records.ts
 */
import { expect, test } from "bun:test"
import type { ActorVisibleContextEntry } from "@/shared"
import { applyMemoryUpdate, parseMemoryUpdate, activeMemoryRecords } from "./memory-records"

const promise: ActorVisibleContextEntry = { id: "first:actor-1", kind: "in", roundIndex: 1, content: "Finance: I will deliver the revised budget tomorrow." }
const fulfilled: ActorVisibleContextEntry = { id: "later:actor-1", kind: "in", roundIndex: 20, content: "Finance: I delivered the revised budget." }
const add = { additions: [{ kind: "commitment", quote: "I will deliver the revised budget tomorrow." }], closures: [] }

test("an accepted promise survives empty updates and closes only with a later cited record", () => {
  const first = applyMemoryUpdate(undefined, promise, parseMemoryUpdate(add, promise, []), "actor-1")
  const record = first.records[0]!
  expect(record.sourceEntryId).toBe(promise.id)
  expect(record.status).toBe("active")
  const unrelated = { ...fulfilled, id: "unrelated", content: "We are still discussing the launch." }
  const next = applyMemoryUpdate(first, unrelated, parseMemoryUpdate({ additions: [], closures: [] }, unrelated, first.records), "actor-1")
  expect(activeMemoryRecords(next)).toEqual([record])
  const closed = applyMemoryUpdate(next, fulfilled, parseMemoryUpdate({ additions: [], closures: [
    { recordId: record.id, quote: "I delivered the revised budget." },
  ] }, fulfilled, next.records), "actor-1")
  expect(activeMemoryRecords(closed)).toEqual([])
  expect(closed.records[0]).toMatchObject({ status: "closed", closure: { entryId: fulfilled.id, quote: "I delivered the revised budget." } })
  expect(first.records[0]?.status).toBe("active")
})

test("invented quotes, foreign record IDs, duplicate changes and non-object updates are rejected", () => {
  expect(() => parseMemoryUpdate({ additions: [{ kind: "decision", quote: "We approved the budget." }], closures: [] }, promise, [])).toThrow("quote")
  expect(() => parseMemoryUpdate({ additions: [], closures: [{ recordId: "other-actor", quote: "I delivered the revised budget." }] }, fulfilled, [])).toThrow("active")
  expect(() => parseMemoryUpdate("no changes", promise, [])).toThrow()
  expect(() => parseMemoryUpdate({ additions: Array(2).fill({ kind: "commitment", quote: "I will deliver the revised budget tomorrow." }), closures: [] }, promise, [])).toThrow("Duplicate")
})

test("replaying an accepted entry cannot create another record or advance the cursor twice", () => {
  const update = parseMemoryUpdate(add, promise, [])
  const first = applyMemoryUpdate(undefined, promise, update, "actor-1")
  expect(applyMemoryUpdate(first, promise, update, "actor-1")).toBe(first)
  expect(first.processedCount).toBe(1)
  expect(first.lastEntryId).toBe(promise.id)
})

test("identical promises by different speakers remain distinct and capacity never evicts active records", () => {
  const firstEntry = { ...promise, sourceActorId: "finance", sourceActorName: "Finance" }
  let ledger = applyMemoryUpdate(undefined, firstEntry, parseMemoryUpdate(add, firstEntry, []), "reader")
  const second = { ...promise, id: "second", sourceActorId: "cto", sourceActorName: "CTO" }
  ledger = applyMemoryUpdate(ledger, second, parseMemoryUpdate(add, second, ledger.records), "reader")
  expect(ledger.records.map(record => record.sourceActorName)).toEqual(["Finance", "CTO"])
  for (let index = 2; index < 24; index++) {
    const entry = { ...promise, id: `entry-${index}`, sourceActorId: `speaker-${index}` }
    ledger = applyMemoryUpdate(ledger, entry, parseMemoryUpdate(add, entry, ledger.records), "reader")
  }
  const overflow = { ...promise, id: "overflow", sourceActorId: "another" }
  expect(() => applyMemoryUpdate(ledger, overflow, parseMemoryUpdate(add, overflow, ledger.records), "reader")).toThrow("capacity")
  expect(activeMemoryRecords(ledger)).toHaveLength(24)
  expect(ledger.records[0]?.quote).toBe("I will deliver the revised budget tomorrow.")
})
