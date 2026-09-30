/**
 * Purpose: Verify world navigation restores its exact batch without changing unrelated run state.
 * Pattern: Session adapter contract tests.
 * Usage: bun test src/ui/browser-storage/world-navigation.test.ts
 * Related: src/ui/browser-storage/world-navigation.ts
 */
import { expect, test } from "bun:test"
import { rememberWorldVisit, readWorldVisit, restoreWorldList } from "./world-navigation"
import { readDocumentScenarioSession, writeDocumentScenarioSession } from "./scenario-builder-session"
import { readMultiverseSession } from "./multiverse-session"

const visit = { scenarioId: "11111111-1111-4111-8111-111111111111", batchId: "22222222-2222-4222-8222-222222222222",
  worldId: "33333333-3333-4333-8333-333333333333", runId: "world-33333333-3333-4333-8333-333333333333" }
function withStorage(action: (values: Map<string, string>) => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
  try { action(values) } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
  }
}
test("a reload-readable origin restores the owning scenario and batch, keeping the selected world", () => withStorage(values => {
  writeDocumentScenarioSession({ buildId: visit.scenarioId, documentSetId: "44444444-4444-4444-8444-444444444444", language: "ko" })
  values.set("simula.run-session", '{"runId":"unchanged","autoContinue":true}')
  rememberWorldVisit(visit)
  expect(readWorldVisit()).toEqual(visit)
  expect(restoreWorldList(visit.runId)).toBe(true)
  expect(readMultiverseSession(visit.scenarioId)).toBe(visit.batchId)
  expect(readDocumentScenarioSession()).toMatchObject({ buildId: visit.scenarioId, language: "ko", documentSetId: "44444444-4444-4444-8444-444444444444" })
  expect(values.get("simula.run-session")).toBe('{"runId":"unchanged","autoContinue":true}')
}))
test("an unrelated run cannot restore a previous world's list", () => withStorage(values => {
  rememberWorldVisit(visit)
  const before = [...values]
  expect(restoreWorldList("different-run")).toBe(false)
  expect([...values]).toEqual(before)
}))
test("returning targets the recorded scenario rather than a more recent form session", () => withStorage(() => {
  rememberWorldVisit(visit)
  writeDocumentScenarioSession({ buildId: "55555555-5555-4555-8555-555555555555", pendingGeneration: true })
  expect(restoreWorldList(visit.runId)).toBe(true)
  expect(readDocumentScenarioSession()).toEqual({ buildId: visit.scenarioId, pendingGeneration: false })
}))
test("malformed origins and mismatched world/run identities are rejected", () => withStorage(values => {
  expect(() => rememberWorldVisit({ ...visit, runId: "another-run" })).toThrow()
  rememberWorldVisit(visit)
  const key = [...values.keys()].find(key => values.get(key)?.includes(visit.worldId))!
  values.set(key, "{bad json")
  expect(readWorldVisit()).toBeUndefined()
  expect(restoreWorldList(visit.runId)).toBe(false)
}))
