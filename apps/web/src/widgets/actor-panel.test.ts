import { describe, expect, test } from "bun:test"
import type { ActorState, Interaction, RunEvent } from "@simula/shared"
import type { UiTexts } from "@/lib/i18n"
import { buildActorHistory, buildActorReasoning, buildActorSummaries, filterHistory } from "./actor-panel"

const timestamp = "2026-04-28T00:00:00.000Z"
const t = {
  actorMessage: "Actor message",
  modelStep: "Model",
  actionTaken: "Action taken",
  receivedInteraction: "Received interaction",
  to: "To",
  from: "From",
  self: "self",
} as UiTexts

describe("actor panel view model", () => {
  test("builds actor info from actors ready events before final run state is available", () => {
    const history = buildActorHistory([actorsReady()], [], actorNames(), t)
    const actors = buildActorSummaries([], [], [actorsReady()], history)

    expect(actors[0]).toMatchObject({
      id: "actor-1",
      name: "서연",
      role: "퍼포먼스 마케터",
      backgroundHistory: "Checks every product claim against conversion data.",
      personality: "Careful and data-driven.",
      preference: "Prevent wasteful spend.",
      privateGoal: "Protect her launch budget.",
      contextSummary: "No compressed context yet.",
    })
  })

  test("sorts actor history by latest round first and preserves counterpart names", () => {
    const history = buildActorHistory([
      interactionRecorded("interaction-1", 1, "actor-1", ["actor-2"], "Round one pressure."),
      interactionRecorded("interaction-2", 3, "actor-2", ["actor-1"], "Round three reply."),
    ], [], actorNames(), t).filter((item) => item.id.startsWith("actor-1:"))

    expect(history.map((item) => [item.roundIndex, item.counterpartName, item.content])).toEqual([
      [3, "지훈", "Round three reply."],
      [1, "지훈", "Round one pressure."],
    ])
  })

  test("filters all, outgoing, incoming, and message history", () => {
    const history = buildActorHistory([
      interactionRecorded("interaction-1", 1, "actor-1", ["actor-2"], "Round one pressure."),
      interactionRecorded("interaction-2", 2, "actor-2", ["actor-1"], "Round two reply."),
      actorMessage("actor-1", "Internal note."),
    ], [], actorNames(), t).filter((item) => item.id.startsWith("actor-1:"))

    expect(filterHistory(history, "all")).toHaveLength(3)
    expect(filterHistory(history, "outgoing")).toHaveLength(1)
    expect(filterHistory(history, "incoming")).toHaveLength(1)
    expect(filterHistory(history, "message")).toHaveLength(1)
  })

  test("keeps actor model trace out of activity history", () => {
    const history = buildActorHistory([
      modelMessage("서연 intent: actor-2와 actor-1-public-1 행동을 선택했습니다."),
      interactionRecorded("interaction-1", 1, "actor-1", ["actor-2"], "actor-1-public-1 reached actor-2."),
      actorMessage("actor-1", "actor-2에게 actor-1-public-1을 제안합니다."),
    ], [], actorNames(), t, stateActors()).filter((item) => item.id.startsWith("actor-1:"))

    expect(history).toHaveLength(2)
    expect(history.map((item) => item.title)).toEqual(["Action taken", "Actor message"])
    expect(history.map((item) => item.content)).toEqual([
      "Public move 1 reached 지훈.",
      "지훈에게 Public move 1을 제안합니다.",
    ])
  })

  test("summarizes latest activity without model trace or internal ids", () => {
    const actors = buildActorSummaries(stateActors(), [], [
      modelMessage("서연 intent: actor-2와 actor-1-public-1 행동을 선택했습니다."),
      interactionRecorded("interaction-1", 1, "actor-1", ["actor-2"], "actor-1-public-1 reached actor-2."),
    ], buildActorHistory([
      interactionRecorded("interaction-1", 1, "actor-1", ["actor-2"], "actor-1-public-1 reached actor-2."),
    ], [], actorNames(), t, stateActors()))

    expect(actors.find((actor) => actor.id === "actor-1")?.latestActivity).toBe("Public move 1 reached 지훈.")
    expect(actors.find((actor) => actor.id === "actor-1")?.messageCount).toBe(0)
  })

  test("keeps actor reasoning separate from activity history", () => {
    const events = [
      actorReasoning("actor-1", "서연", "intent", "thinking privately"),
      actorMessage("actor-1", "Visible note."),
    ]
    const history = buildActorHistory(events, [], actorNames(), t).filter((item) => item.id.startsWith("actor-1:"))
    const reasoning = buildActorReasoning(events)

    expect(history).toHaveLength(1)
    expect(reasoning).toMatchObject([{ actorId: "actor-1", content: "thinking privately" }])
  })

  test("labels no-action and solitary activity without self targets", () => {
    const history = buildActorHistory([
      interactionRecorded("interaction-1", 1, "actor-1", [], "Actor 1 held back.", "no_action", "solitary"),
      interactionRecorded("interaction-2", 2, "actor-1", [], "Actor 1 thinks alone.", "action", "solitary"),
    ], [], actorNames(), t).filter((item) => item.id.startsWith("actor-1:"))

    expect(history.map((item) => [item.roundIndex, item.counterpartName])).toEqual([
      [2, "SOLO"],
      [1, "HELD"],
    ])
  })
})

function actorsReady(): Extract<RunEvent, { type: "actors.ready" }> {
  return {
    type: "actors.ready",
    runId: "run-test",
    timestamp,
    actors: [{
      id: "actor-1",
      label: "서연",
      role: "퍼포먼스 마케터",
      intent: "Use data before acting.",
      interactionCount: 0,
      backgroundHistory: "Checks every product claim against conversion data.",
      personality: "Careful and data-driven.",
      preference: "Prevent wasteful spend.",
      privateGoal: "Protect her launch budget.",
      contextSummary: "No compressed context yet.",
    }],
  }
}

function actorNames(): Map<string, string> {
  return new Map([
    ["actor-1", "서연"],
    ["actor-2", "지훈"],
    ["actor-3", "민지"],
  ])
}

function stateActors(): ActorState[] {
  return [
    {
      id: "actor-1",
      name: "서연",
      role: "퍼포먼스 마케터",
      backgroundHistory: "Checks every product claim against conversion data.",
      personality: "Careful and data-driven.",
      preference: "Prevent wasteful spend.",
      privateGoal: "Protect her launch budget.",
      intent: "Use actor-1-public-1 with actor-2.",
      actions: [{
        id: "actor-1-public-1",
        visibility: "public",
        label: "Public move 1",
        intentHint: "Open pressure.",
        expectedOutcome: "Public pressure increases.",
      }],
      context: { visible: [] },
      contextSummary: "No compressed context yet.",
      memory: [],
      relationships: {},
    },
    {
      id: "actor-2",
      name: "지훈",
      role: "엔지니어",
      backgroundHistory: "Owns system reliability.",
      personality: "Direct.",
      preference: "Reduce risk.",
      privateGoal: "Avoid blame.",
      intent: "",
      actions: [],
      context: { visible: [] },
      contextSummary: "",
      memory: [],
      relationships: {},
    },
  ]
}

function interactionRecorded(
  id: string,
  roundIndex: number,
  sourceActorId: string,
  targetActorIds: string[],
  content: string,
  decisionType: Interaction["decisionType"] = "action",
  visibility: Interaction["visibility"] = "public"
): Extract<RunEvent, { type: "interaction.recorded" }> {
  return {
    type: "interaction.recorded",
    runId: "run-test",
    timestamp,
    interaction: interaction(id, roundIndex, sourceActorId, targetActorIds, content, decisionType, visibility),
  }
}

function interaction(
  id: string,
  roundIndex: number,
  sourceActorId: string,
  targetActorIds: string[],
  content: string,
  decisionType: Interaction["decisionType"] = "action",
  visibility: Interaction["visibility"] = "public"
): Interaction {
  return {
    id,
    roundIndex,
    sourceActorId,
    targetActorIds,
    actionType: "public-action",
    content,
    eventId: "event-1",
    visibility,
    decisionType,
    intent: "Create pressure.",
    expectation: "The target responds.",
  }
}

function actorMessage(actorId: string, content: string): Extract<RunEvent, { type: "actor.message" }> {
  return {
    type: "actor.message",
    runId: "run-test",
    timestamp,
    actorId,
    actorName: actorNames().get(actorId) ?? actorId,
    content,
  }
}

function modelMessage(content: string): Extract<RunEvent, { type: "model.message" }> {
  return {
    type: "model.message",
    runId: "run-test",
    timestamp,
    role: "actor",
    content,
  }
}

function actorReasoning(
  actorId: string,
  actorName: string,
  step: Extract<RunEvent, { type: "model.reasoning" }>["step"],
  content: string
): Extract<RunEvent, { type: "model.reasoning" }> {
  return {
    type: "model.reasoning",
    runId: "run-test",
    timestamp,
    role: "actor",
    step,
    attempt: 1,
    content,
    reasoningTokens: 7,
    actorId,
    actorName,
  }
}
