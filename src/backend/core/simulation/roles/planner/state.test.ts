/**
 * Purpose: Verify planned event count follows the chosen round limit.
 * Pattern: Pure state policy tests.
 * Usage: bun test src/backend/core/simulation/roles/planner/state.test.ts
 * Related: src/backend/core/simulation/roles/planner/state.ts
 */
import { expect, test } from "bun:test"
import { parsePlannerMajorEvents } from "./state"

const lines = ["First - An opening event.", "Second - A later event.", "Third - A final event.", "Fourth - Another event."].join("\n")

test("ordinary rounds only retain events they can reach", () => {
  expect(parsePlannerMajorEvents(lines, 2).map(event => event.id)).toEqual(["event-1", "event-2"])
  expect(() => parsePlannerMajorEvents("First - One event.", 2)).toThrow("at least 2")
})

test("autonomous progression may retain events beyond the ordinary round limit", () => {
  expect(parsePlannerMajorEvents(lines, 2, true).map(event => event.id)).toEqual(["event-1", "event-2", "event-3"])
})
