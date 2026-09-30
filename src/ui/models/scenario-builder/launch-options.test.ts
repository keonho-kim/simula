/**
 * Purpose: Verify world counts and runtime option boundaries.
 * Pattern: Unit tests.
 * Usage: bun test src/ui/models/scenario-builder/launch-options.test.ts
 * Related: src/ui/models/scenario-builder/launch-options.ts
 */
import { expect, test } from "bun:test"
import { builderRequestFields, validMultiverse, worldControlsFromScenario } from "./launch-options"

test("enabled world counts are bounded integers; disabled counts do not block a single run", () => {
  for (const worldCount of [0, -1, 51, 2.5, NaN]) expect(validMultiverse({ enabled: true, worldCount })).toBe(false)
  for (const worldCount of [1, 4, 50]) expect(validMultiverse({ enabled: true, worldCount })).toBe(true)
  expect(validMultiverse({ enabled: false, worldCount: 0 })).toBe(true)
  expect(validMultiverse()).toBe(true)
})
test("launch options remain local and strict world controls exclude roster fields", () => {
  const controls = worldControlsFromScenario({ numCast: 3, allowAdditionalCast: false, actionsPerType: 2,
    maxRound: 4, fastMode: true, autonomousProgress: false, outputLength: "short" })
  expect(controls).toEqual({ actionsPerType: 2, maxRound: 4, fastMode: true, autonomousProgress: false, outputLength: "short" })
  expect(builderRequestFields({ context: "Review", situation: "auto", fastMode: true, participants: [],
    controls, multiverse: { enabled: true, worldCount: 50 } })).toEqual({ context: "Review", situation: "auto", fastMode: true, participants: [] })
})
