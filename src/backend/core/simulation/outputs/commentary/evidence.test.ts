import { expect, test } from "bun:test"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { parseScenarioDocument } from "@/backend/core/scenario"
import { prepareReportEvidence } from "./evidence"

test("all interactions enter bounded packets instead of dropping middle history", () => {
  const state = initialSimulationState("r", parseScenarioDocument("---\nnum_cast: 2\n---\nTest"))
  state.interactions = Array.from({ length: 25 }, (_, i) => ({
    id: `i${i}`,
    sourceActorId: "a",
    targetActorIds: [],
    roundIndex: 1,
    eventId: "e",
    visibility: "solitary",
    decisionType: "action",
    actionType: "Review",
    content: "x".repeat(5000),
    intent: "Think",
    expectation: "Clarity"
  }))
  const { packets } = prepareReportEvidence(state)
  expect(packets).toHaveLength(4)
  expect(packets.flatMap((packet) => packet.evidenceIds.filter((id) => id.startsWith("i")))).toEqual(
    state.interactions.map((item) => item.id)
  )
  expect(
    packets.every((packet) => JSON.parse(packet.text).interactions.length <= 8 && packet.text.length < 6000)
  ).toBe(true)
})
