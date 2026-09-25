/**
 * Purpose: Verify incomplete cards cannot be accepted through invented fallback attributes.
 * Pattern: Card completion contract test.
 * Usage: bun test src/backend/core/simulation/roles/generator/cards/state.test.ts
 * Related: src/backend/core/simulation/roles/generator/cards/state.ts
 */
import { expect, test } from "bun:test"
import { completeActorCard, initialActorCardState } from "./state"

test("card completion requires every generated field and preserves the assigned name", () => {
  const state = initialActorCardState()
  expect(() => completeActorCard(state, "Finance")).toThrow("incomplete")
  const complete = { role: "Budget owner", backgroundHistory: "Reviews operating plans.", personality: "Evidence-driven.", preference: "Preserve reserves.", name: "Unapproved replacement" }
  state.card = complete
  expect(completeActorCard(state, "Finance")).toEqual({ ...complete, name: "Finance" })
  state.card.personality = " "
  expect(() => completeActorCard(state, "Finance")).toThrow("incomplete")
})
