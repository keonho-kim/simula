/**
 * Purpose: Verify report references preserve full source text and isolate world observations.
 * Pattern: Pure evidence contract test.
 * Usage: bun test src/backend/core/simulation/outputs/analysis/evidence.test.ts
 * Related: src/backend/core/simulation/outputs/analysis/evidence.ts
 */
import { expect, test } from "bun:test"
import { worldReferences } from "./evidence"

test("long recorded speech is partitioned without dropping its ending or colliding across worlds", () => {
  const speech = "조건을 확인합니다. ".repeat(500) + "마지막 조건은 보류합니다."
  const input = { runId: "world-one", scenario: { text: "Review", controls: {} }, actors: [{ id: "a", name: "Finance", role: "Decision maker" }],
    interactions: [{ id: "interaction-1", roundIndex: 2, sourceActorId: "a", targetActorIds: [], actionType: "검토", content: speech, intent: "확인" }],
    roundReports: [], roundDigests: [], stopReason: "simulation_done" }
  const first = worldReferences(input, "world-one")
  const second = worldReferences({ ...input, runId: "world-two" }, "world-two")
  const speechParts = first.filter(ref => ref.recordId === "interaction-1")
  expect(first[0]?.recordId).toBe("interaction-1")
  expect(first.find(ref => ref.recordId === "termination")?.category).toBe("analytical_interpretation")
  expect(speechParts.length).toBeGreaterThan(1)
  expect(speechParts[0].text).toContain("Simulated interaction")
  expect(speechParts.map(ref => ref.text).join("")).toContain(speech)
  expect(first.every(ref => ref.text.length <= 1800)).toBe(true)
  expect(first.some(ref => second.some(other => other.id === ref.id))).toBe(false)
  expect(() => worldReferences(input, "different-owner")).toThrow("identity")
})
