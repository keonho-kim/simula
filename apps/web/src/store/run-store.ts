import { create } from "zustand"
import type { GraphTimelineFrame, RunEvent, RunManifest, SimulationState } from "@simula/shared"

interface RunUiState {
  selectedRunId?: string
  liveEvents: RunEvent[]
  metricEvents: RunEvent[]
  actorEvents: RunEvent[]
  timeline: GraphTimelineFrame[]
  runState?: SimulationState
  replayIndex: number
  setSelectedRunId: (runId: string | undefined) => void
  resetLiveState: () => void
  pushEvent: (event: RunEvent) => void
  pushEvents: (events: RunEvent[]) => void
  setReplayIndex: (index: number) => void
  syncRunDetail: (run: RunManifest, timeline: GraphTimelineFrame[], runState: SimulationState | undefined, events: RunEvent[]) => void
}

export const useRunStore = create<RunUiState>((set) => ({
  selectedRunId: undefined,
  liveEvents: [],
  metricEvents: [],
  actorEvents: [],
  timeline: [],
  runState: undefined,
  replayIndex: 0,
  setSelectedRunId: (runId) => set({ selectedRunId: runId }),
  resetLiveState: () => set({ liveEvents: [], metricEvents: [], actorEvents: [], timeline: [], runState: undefined, replayIndex: 0 }),
  pushEvent: (event) =>
    set((state) => applyEvents(state, [event])),
  pushEvents: (events) =>
    set((state) => {
      if (!events.length) {
        return state
      }
      return applyEvents(state, events)
    }),
  setReplayIndex: (index) => set({ replayIndex: index }),
  syncRunDetail: (run, timeline, runState, events) =>
    set((state) => {
      const nextMetricEvents = metricEvents(events)
      const nextActorEvents = actorEvents(events)
      return {
        selectedRunId: state.selectedRunId ?? run.id,
        liveEvents: mergeEvents(state.liveEvents, events).slice(-300),
        metricEvents: nextMetricEvents.length ? mergeEvents(state.metricEvents, nextMetricEvents) : state.metricEvents,
        actorEvents: nextActorEvents.length ? mergeEvents(state.actorEvents, nextActorEvents) : state.actorEvents,
        timeline,
        runState,
        replayIndex: timeline.length ? timeline.length - 1 : 0,
      }
    }),
}))

function applyEvents(state: RunUiState, events: RunEvent[]): Partial<RunUiState> {
  const frames = events
    .filter((event): event is Extract<RunEvent, { type: "graph.delta" }> => event.type === "graph.delta")
    .map((event) => event.frame)
  const nextTimeline = frames.length ? [...state.timeline, ...frames] : state.timeline
  const nextMetricEvents = metricEvents(events)
  const nextActorEvents = actorEvents(events)
  return {
    liveEvents: mergeEvents(state.liveEvents, events).slice(-300),
    metricEvents: nextMetricEvents.length ? mergeEvents(state.metricEvents, nextMetricEvents) : state.metricEvents,
    actorEvents: nextActorEvents.length ? mergeEvents(state.actorEvents, nextActorEvents) : state.actorEvents,
    timeline: nextTimeline,
    replayIndex: nextTimeline.length ? nextTimeline.length - 1 : state.replayIndex,
  }
}

function metricEvents(events: RunEvent[]): RunEvent[] {
  return events.filter((event) => event.type === "model.metrics")
}

function actorEvents(events: RunEvent[]): RunEvent[] {
  return events.filter(
    (event) =>
      event.type === "actors.ready" ||
      event.type === "interaction.recorded" ||
      event.type === "actor.message" ||
      (event.type === "model.message" && event.role === "actor")
  )
}

function mergeEvents(current: RunEvent[], incoming: RunEvent[]): RunEvent[] {
  const seen = new Set(current.map(eventKey))
  const merged = [...current]
  for (const event of incoming) {
    const key = eventKey(event)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    merged.push(event)
  }
  return merged
}

function eventKey(event: RunEvent): string {
  if (event.type === "graph.delta") {
    return `${event.runId}:graph.delta:${event.frame.index}`
  }
  if (event.type === "interaction.recorded") {
    return `${event.runId}:interaction.recorded:${event.interaction.id}`
  }
  if (event.type === "event.injected") {
    return `${event.runId}:event.injected:${event.event.id}`
  }
  if (event.type === "round.completed") {
    return `${event.runId}:round.completed:${event.roundIndex}`
  }
  if (event.type === "model.metrics") {
    return `${event.runId}:model.metrics:${event.metrics.role}:${event.metrics.step}:${event.metrics.attempt}:${event.timestamp}`
  }
  return `${event.runId}:${event.type}:${event.timestamp}:${JSON.stringify(event)}`
}
