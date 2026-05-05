import { beforeEach, describe, expect, test } from "bun:test"
import type { RunEvent, RunManifest } from "@simula/shared"
import { useRunStore } from "./run-store"

const runId = "run-test"
const timestamp = "2026-04-28T00:00:00.000Z"

describe("run store", () => {
  beforeEach(() => {
    useRunStore.setState({ selectedRunId: undefined })
    useRunStore.getState().resetLiveState()
  })

  test("keeps metric events after live event window trimming", () => {
    const metric = modelMetrics("planner", "coreSituation", 100)
    const logs = Array.from({ length: 301 }, (_, index) => logEvent(index))

    useRunStore.getState().pushEvents([metric, ...logs])

    const state = useRunStore.getState()
    expect(state.liveEvents).toHaveLength(300)
    expect(state.liveEvents.some((event) => event.type === "model.metrics")).toBe(false)
    expect(state.metricEvents).toEqual([metric])
  })

  test("deduplicates metric events across stream and run detail sync", () => {
    const metric = modelMetrics("coordinator", "runtimeFrame", 120)

    useRunStore.getState().pushEvent(metric)
    useRunStore.getState().syncRunDetail(runManifest(), [], undefined, [metric])

    expect(useRunStore.getState().metricEvents).toEqual([metric])
  })

  test("resets metric events with live state", () => {
    useRunStore.getState().pushEvent(modelMetrics("observer", "thought", 80))

    useRunStore.getState().resetLiveState()

    expect(useRunStore.getState().metricEvents).toEqual([])
  })

  test("keeps actor events after live event window trimming", () => {
    const interaction = interactionRecorded("interaction-1", 1)
    const logs = Array.from({ length: 301 }, (_, index) => logEvent(index))

    useRunStore.getState().pushEvents([interaction, ...logs])

    const state = useRunStore.getState()
    expect(state.liveEvents).toHaveLength(300)
    expect(state.liveEvents.some((event) => event.type === "interaction.recorded")).toBe(false)
    expect(state.actorEvents).toEqual([interaction])
  })

  test("deduplicates actor events across stream and run detail sync", () => {
    const interaction = interactionRecorded("interaction-1", 1)

    useRunStore.getState().pushEvent(interaction)
    useRunStore.getState().syncRunDetail(runManifest(), [], undefined, [interaction])

    expect(useRunStore.getState().actorEvents).toEqual([interaction])
  })

  test("does not keep actor model trace as actor activity", () => {
    const trace = modelMessage("actor intent: internal trace")

    useRunStore.getState().pushEvent(trace)

    expect(useRunStore.getState().actorEvents).toEqual([])
    expect(useRunStore.getState().liveEvents).toEqual([trace])
  })

  test("deduplicates injected events by event id", () => {
    const injected = eventInjected("round-1-event-1")

    useRunStore.getState().pushEvent(injected)
    useRunStore.getState().syncRunDetail(runManifest(), [], undefined, [injected])

    expect(useRunStore.getState().liveEvents.filter((event) => event.type === "event.injected")).toEqual([injected])
  })

  test("resets actor events with live state", () => {
    useRunStore.getState().pushEvent(interactionRecorded("interaction-1", 1))

    useRunStore.getState().resetLiveState()

    expect(useRunStore.getState().actorEvents).toEqual([])
  })
})

function modelMetrics(
  role: Extract<RunEvent, { type: "model.metrics" }>["metrics"]["role"],
  step: Extract<RunEvent, { type: "model.metrics" }>["metrics"]["step"],
  totalTokens: number
): Extract<RunEvent, { type: "model.metrics" }> {
  return {
    type: "model.metrics",
    runId,
    timestamp,
    metrics: {
      role,
      step,
      attempt: 1,
      ttftMs: 10,
      durationMs: 100,
      inputTokens: Math.floor(totalTokens / 2),
      reasoningTokens: 0,
      outputTokens: Math.ceil(totalTokens / 2),
      totalTokens,
      tokenSource: "provider",
    },
  }
}

function logEvent(index: number): RunEvent {
  return {
    type: "log",
    runId,
    timestamp: `2026-04-28T00:00:${String(index % 60).padStart(2, "0")}.${String(index).padStart(3, "0")}Z`,
    level: "info",
    message: `event ${index}`,
  }
}

function interactionRecorded(id: string, roundIndex: number): Extract<RunEvent, { type: "interaction.recorded" }> {
  return {
    type: "interaction.recorded",
    runId,
    timestamp,
    interaction: {
      id,
      roundIndex,
      sourceActorId: "actor-1",
      targetActorIds: ["actor-2"],
      actionType: "public-action",
      content: "Actor 1 sends pressure to Actor 2.",
      eventId: "event-1",
      visibility: "public",
      decisionType: "action",
      intent: "Create pressure.",
      expectation: "Actor 2 responds.",
    },
  }
}

function modelMessage(content: string): Extract<RunEvent, { type: "model.message" }> {
  return {
    type: "model.message",
    runId,
    timestamp,
    role: "actor",
    content,
  }
}

function eventInjected(id: string): Extract<RunEvent, { type: "event.injected" }> {
  return {
    type: "event.injected",
    runId,
    timestamp,
    event: {
      id,
      roundIndex: 1,
      sourceEventId: "event-1",
      title: "Public pressure",
      summary: "A public pressure enters the round.",
    },
  }
}

function runManifest(): RunManifest {
  return {
    id: runId,
    status: "running",
    createdAt: timestamp,
    artifactPaths: {
      manifest: "manifest.json",
      events: "events.jsonl",
      state: "state.json",
      report: "report.md",
      timeline: "timeline.json",
    },
  }
}
