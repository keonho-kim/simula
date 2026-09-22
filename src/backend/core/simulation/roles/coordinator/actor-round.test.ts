/**
 * Purpose: Verify actor round batching follows the configured causal ordering policy.
 * Pattern: Policy contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/core/simulation/roles/coordinator/actor-round.ts
 */
import { expect, test } from "bun:test"
import type { ActorState } from "@/shared"
import { actorExecutionBatches } from "./actor-round"

const actors = [actor("first"), actor("second"), actor("third")]

test("normal mode exposes each actor as one causal batch", () => {
  expect(actorExecutionBatches(actors, false).map((batch) => batch.map((item) => item.id))).toEqual([
    ["first"],
    ["second"],
    ["third"],
  ])
})

test("fast mode evaluates all actors against one shared snapshot", () => {
  expect(actorExecutionBatches(actors, true)).toEqual([actors])
})

function actor(id: string): ActorState {
  return {
    id,
    name: id,
    role: "role",
    backgroundHistory: "history",
    personality: "personality",
    preference: "preference",
    privateGoal: "goal",
    intent: "intent",
    actions: [],
    context: { visible: [] },
    contextSummary: "",
    memory: [],
    relationships: {},
  }
}
