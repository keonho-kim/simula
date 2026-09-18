import { beforeEach, describe, expect, test } from "bun:test"
import type { RunEvent, RunManifest } from "@/shared"
import { useRunStore } from "@/ui/stores/run-store"

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

describe("render subscriptions", () => {
  test("conversation subscribers ignore telemetry and duplicate history", () => {
    const store = useRunStore.getState()
    store.resetLiveState()
    let conversationUpdates = 0
    const unsubscribe = useRunStore.subscribe((state, previous) => {
      if (state.conversationEvents !== previous.conversationEvents) conversationUpdates++
    })
    const interaction = interactionRecorded("conversation-1", 1)
    store.pushEvent(interaction)
    store.pushEvent(modelMetrics("actor", "message", 100))
    store.pushEvent({ type: "model.reasoning", runId, timestamp, role: "actor", step: "thought", attempt: 1, content: "reasoning", reasoningTokens: 1 })
    store.syncRunDetail(runManifest(), [], undefined, [interaction])
    expect(conversationUpdates).toBe(1)
    expect(useRunStore.getState().conversationEvents).toEqual([interaction])
    store.resetLiveState()
    store.pushEvent(interaction)
    expect(useRunStore.getState().conversationEvents).toEqual([interaction])
    unsubscribe()
  })
})

test("deduplicates streamed graph frames and retains newer frames across an older detail response", () => {
  const store = useRunStore.getState()
  store.resetLiveState()
  const frame = (index: number) => ({ index, timestamp, nodes: [], edges: [], activeNodeIds: [], messages: [], logRefs: [] })
  const first = frame(0)
  const second = frame(1)
  store.syncRunDetail(runManifest(), [first], undefined, [])
  store.pushEvents([first, second].map((frame) => ({ type: "graph.delta", runId, timestamp, frame })))
  expect(useRunStore.getState().timeline).toEqual([first, second])
  const streamed = useRunStore.getState().liveEvents.filter((event) => event.type === "graph.delta")
  expect(streamed[1]!.frame).toBe(useRunStore.getState().timeline[1])
  const timeline = useRunStore.getState().timeline
  store.syncRunDetail(runManifest(), [structuredClone(first)], undefined, [])
  expect(useRunStore.getState().timeline).toBe(timeline)
  store.pushEvent({ type: "graph.delta", runId, timestamp, frame: second })
  expect(useRunStore.getState().timeline).toBe(timeline)
})

test("shared projections apply duplicated stream and HTTP events once and reset with the run", () => {
  const store = useRunStore.getState()
  store.resetLiveState()
  const events = [modelMetrics("actor", "message", 100), interactionRecorded("projection", 1)]
  store.pushEvents(events)
  const first = useRunStore.getState()
  store.syncRunDetail(runManifest(), [], undefined, events)
  expect(useRunStore.getState().metricData).toBe(first.metricData)
  expect(useRunStore.getState().conversationData).toBe(first.conversationData)
  expect(first.metricData.ttft).toHaveLength(1)
  expect(first.conversationData.rounds[0]!.messages).toHaveLength(1)
  store.resetLiveState()
  expect(useRunStore.getState().metricData.ttft).toHaveLength(0)
  expect(useRunStore.getState().conversationData.rounds).toHaveLength(0)
})

test("report polling preserves the replay cursor when no frames were added", () => {
  const store = useRunStore.getState()
  store.resetLiveState()
  store.setSelectedRunId(runId)
  const frames = [0, 1, 2].map(index => ({ index, timestamp, nodes: [], edges: [], activeNodeIds: [], messages: [], logRefs: [] }))
  store.syncRunDetail(runManifest(), frames, undefined, [])
  store.setReplayIndex(0)
  store.syncRunDetail(runManifest(), frames, undefined, [])
  expect(useRunStore.getState().replayIndex).toBe(0)
})
