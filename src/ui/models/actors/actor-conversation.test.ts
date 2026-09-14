import { describe, expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { buildActorRounds } from "@/ui/models/actors/actor-conversation"

const timestamp = "2026-09-15T00:00:00.000Z"
function recorded(roundIndex: number, sourceActorId = "actor-1"): RunEvent {
  return { type: "interaction.recorded", runId: "run", timestamp,
    interaction: { id: `${roundIndex}-${sourceActorId}`, roundIndex, sourceActorId, targetActorIds: ["actor-2"],
      actionType: "Ask for evidence", content: "Alice: Show me the numbers.", thought: "Bob may know more.",
      eventId: "event", visibility: "private", decisionType: "action", intent: "Check facts", expectation: "Evidence" } }
}
const ready: RunEvent = { type: "actors.ready", runId: "run", timestamp, actors: [
  { id: "actor-1", label: "Alice", role: "Chair", intent: "", interactionCount: 0 },
  { id: "actor-2", label: "Bob", role: "Analyst", intent: "", interactionCount: 0 },
] }

describe("actor conversation", () => {
  test("groups rounds and combines thought and speech once per interaction", () => {
    const rounds = buildActorRounds([ready, recorded(2), recorded(1), recorded(1),
      { type: "actor.message", runId: "run", timestamp, actorId: "actor-1", actorName: "Alice", content: "Show me the numbers." }])
    expect(rounds.map(round => round.roundIndex)).toEqual([1, 2])
    expect(rounds[0].messages).toHaveLength(1)
    expect(rounds[0].messages[0]).toMatchObject({ actorName: "Alice", targets: ["Bob"], thought: "Bob may know more.", content: "Show me the numbers.", action: "Ask for evidence" })
  })
  test("does not invent thoughts for older records and respects replay cutoff", () => {
    const early = recorded(1)
    if (early.type !== "interaction.recorded") throw new Error("Expected interaction")
    delete early.interaction.thought
    const late = { ...recorded(2), timestamp: "2026-09-15T00:01:00.000Z" }
    const rounds = buildActorRounds([ready, early, late], [], timestamp)
    expect(rounds).toHaveLength(1)
    expect(rounds[0].messages[0].thought).toBe("")
  })
  test("keeps silent actions as a single history entry", () => {
    const event = recorded(1)
    if (event.type !== "interaction.recorded") throw new Error("Expected interaction")
    event.interaction.decisionType = "no_action"
    event.interaction.targetActorIds = []
    const message = buildActorRounds([ready, event])[0].messages[0]
    expect(message.decisionType).toBe("no_action")
    expect(message.targets).toEqual([])
  })
})
