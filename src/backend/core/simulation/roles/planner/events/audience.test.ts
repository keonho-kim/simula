/**
 * Purpose: Verify strict event audience decoding against the actual world roster.
 * Pattern: Pure policy tests.
 * Usage: bun test src/backend/core/simulation/roles/planner/events/audience.test.ts
 * Related: src/backend/core/simulation/roles/planner/events/audience.ts
 */
import { expect, test } from "bun:test"
import { eventAudienceOptions, parseEventAudience } from "./audience"

const roster = [{ id: "actor-1" }, { id: "actor-2" }, { id: "actor-3" }]

test("public and named audiences resolve to explicit canonical world IDs", () => {
  expect(parseEventAudience("0", roster)).toEqual(["actor-1", "actor-2", "actor-3"])
  expect(parseEventAudience("3,1", roster)).toEqual(["actor-1", "actor-3"])
})

test("ambiguous, malformed and foreign audiences never become public", () => {
  for (const text of ["?", "", "1,1", "4", "0,1", "1,", "[1]", "1 because it is private", "1\n2", "everyone"]) {
    expect(() => parseEventAudience(text, roster)).toThrow()
  }
  expect(() => parseEventAudience("0", [])).toThrow()
  expect(() => parseEventAudience("0", [{ id: "same" }, { id: "same" }])).toThrow()
})

test("small rosters offer only public, unresolved or nonempty proper subsets", () => {
  expect(eventAudienceOptions(2)).toEqual(["0", "?", "1", "2"])
  expect(eventAudienceOptions(3)).toContain("1,3")
  expect(eventAudienceOptions(5)).toBeUndefined()
})
