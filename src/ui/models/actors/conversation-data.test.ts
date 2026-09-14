import { expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { buildActorRounds } from "./actor-conversation"
import { emptyConversationData, roundsThrough, updateConversationData } from "./conversation-data"

const ready: RunEvent = { type: "actors.ready", runId: "run", timestamp: "0", actors: [{ id: "a", label: "Alice", role: "Chair", intent: "", interactionCount: 0 }] }
const recorded = (index: number): RunEvent => ({ type: "interaction.recorded", runId: "run", timestamp: String(index), interaction: {
  id: String(index), roundIndex: index, sourceActorId: "a", targetActorIds: [], eventId: "e", visibility: "public", decisionType: "action", actionType: "Speak", content: "a: Hello", intent: "", expectation: "",
} })

test("incremental conversations match full projection, retain old messages and support replay and metadata changes", () => {
  let data = emptyConversationData()
  const events: RunEvent[] = []
  for (const event of [ready, recorded(1), recorded(2)]) {
    const previous = data
    events.push(event)
    data = updateConversationData(data, events, [event])
    expect(data.rounds).toEqual(buildActorRounds(events))
    if (previous.rounds.length) expect(data.rounds[0]).toBe(previous.rounds[0])
  }
  expect(roundsThrough(data.rounds, "1")).toEqual(buildActorRounds(events, [], "1"))
  expect(updateConversationData(data, events, [])).toBe(data)
  const rename: RunEvent = { ...ready, actors: [{ ...ready.actors[0]!, label: "Alicia" }] }
  const renamed = updateConversationData(data, [...events, rename], [rename])
  expect(renamed.rounds).toEqual(buildActorRounds([...events, rename]))
  expect(data.rounds[0]!.messages[0]!.actorName).toBe("Alice")
})
