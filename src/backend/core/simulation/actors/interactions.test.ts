/**
 * Purpose: Verify program-authored activity records respect the simulation output language.
 * Pattern: Pure transformation contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/core/simulation/actors/interactions.ts, src/backend/core/simulation/roles/actor/state.ts
 */
import { expect, test } from "bun:test"
import { buildActorChoiceState, buildDigestSimulation } from "../../../../../packages/core/tests/scenario-fixtures"
import { buildActorDecision } from "../roles/actor/state"
import { buildInteraction } from "./interactions"

test("Korean held and silent-action records are localized without internal scope names", () => {
  const state = buildActorChoiceState()
  state.scenario.language = "ko"
  state.trace.action = "no_action"
  state.coordinatorTrace.outcomeDirection = "근거 확인"
  const decision = buildActorDecision(state)
  expect(decision.expectation).toContain("상황을 지켜본다")
  const fixture = buildDigestSimulation()
  const actor = fixture.actors[0]!
  const event = fixture.plan!.majorEvents[0]!
  expect(buildInteraction(1, event, actor, [actor], decision, "ko").content).toContain("행동을 보류한다")
  expect(buildInteraction(1, event, actor, [actor], decision, "en").content).toContain("held back")
  const content = buildInteraction(1, event, actor, [actor], { ...decision, decisionType: "action" }, "ko").content
  expect(content).toContain("행동을 수행한다")
  expect(content).not.toContain("solitary")
})
