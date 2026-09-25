/**
 * Purpose: Verify incremental timeline frames match accepted ordered event replay.
 * Pattern: Deterministic projection contract test.
 * Usage: bun test src/backend/core/simulation/outputs/timeline-projector.test.ts
 * Related: src/backend/core/simulation/outputs/timeline-projector.ts, src/backend/core/simulation/outputs/timeline.ts
 */
import { expect, test } from "bun:test"
import type { GraphTimelineFrame, RunEvent } from "@/shared"
import { buildTimelineFrame } from "./timeline"
import { TimelineProjector } from "./timeline-projector"

const runId = "timeline-projection"
const timestamp = "2026-09-25T00:00:00.000Z"
const interaction = (id: string, roundIndex: number, targetActorIds: string[]): Extract<RunEvent, { type: "interaction.recorded" }> => ({
  type: "interaction.recorded", runId, timestamp,
  interaction: { id, roundIndex, sourceActorId: "actor-a", targetActorIds, actionType: "proposal",
    content: `Action ${id}`, eventId: "event-a", visibility: "public", decisionType: "action",
    intent: "Propose", expectation: "Respond" },
})

test("incremental frames match replay across messages, logs, repeated actions, and rounds", () => {
  const events: RunEvent[] = [
    { type: "actors.ready", runId, timestamp, actors: [
      { id: "actor-a", label: "Actor A", role: "Lead", intent: "Start", interactionCount: 0 },
      { id: "actor-b", label: "Actor B", role: "Reviewer", intent: "Review", interactionCount: 0 },
    ] },
    { type: "actor.message", runId, timestamp, actorId: "actor-a", actorName: "Actor A", content: "Opening" },
    { type: "log", runId, timestamp, level: "info", message: "Preparation finished" },
    interaction("first", 1, ["actor-b"]),
    interaction("second", 1, ["actor-b"]),
    { type: "model.message", runId, timestamp, role: "planner", content: "Plan updated" },
    { type: "round.completed", runId, timestamp, roundIndex: 1 },
    interaction("third", 2, ["actor-b"]),
    { type: "actor.message", runId, timestamp, actorId: "actor-b", actorName: "Actor B", content: "Counterpoint" },
    { type: "round.completed", runId, timestamp, roundIndex: 2 },
  ]
  const projector = new TimelineProjector()
  const accepted: RunEvent[] = []
  let previous: GraphTimelineFrame | undefined
  let frameIndex = 0
  for (const event of events) {
    accepted.push(event)
    const actual = projector.accept(event)
    if (!actual) continue
    const expected = buildTimelineFrame(frameIndex++, event, previous, accepted)
    expect(actual).toEqual(expected)
    previous = expected
  }
  expect(frameIndex).toBe(6)
})
