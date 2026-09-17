import { expect, test } from "bun:test"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { parseScenarioDocument } from "@/backend/core/scenario"
import { buildConversationBoard } from "./conversation-board"

test("round board retains silent rounds and resolves stored messages and events", () => {
  const state = initialSimulationState("run", parseScenarioDocument("---\nnum_cast: 2\n---\nTest"))
  state.roundDigests = [{ roundIndex: 1, preRound: { elapsedTime: "1h", content: "Context" } }, { roundIndex: 2, preRound: { elapsedTime: "2h", content: "Waiting" } }]
  state.roundReports = [{ roundIndex: 1, title: "Decision", roundSummary: "Asked for time" }]
  state.interactions = [{ id: "i", roundIndex: 1, sourceActorId: "a", targetActorIds: ["b"], actionType: "Ask", content: "a: Tomorrow?", thought: "Need time", intent: "Delay", expectation: "Agreement", eventId: "e", visibility: "private", decisionType: "action" }]
  state.plan = { interpretation: "", backgroundStory: "", actionCatalog: {}, majorEvents: [{ id: "e", title: "Deadline", summary: "Due today", status: "completed", participantIds: [] }] }
  const rounds = buildConversationBoard(state)
  expect(rounds.map(round => round.roundIndex)).toEqual([1, 2])
  expect(rounds[0]?.summary).toBe("Asked for time")
  expect(rounds[0]?.events[0]?.title).toBe("Deadline")
  expect(rounds[0]?.messages[0]).toMatchObject({ thought: "Need time", content: "Tomorrow?" })
  expect(rounds[1]?.messages).toEqual([])
  expect(rounds[1]?.summary).toBe("Waiting")
  expect(buildConversationBoard(undefined)).toEqual([])
})
