import { emptyScenarioBoard, updateScenarioBoard, type ScenarioBoardState } from "@/ui/models/simulation/scenario-board"
import { emptyMetricData, appendMetricData, type MetricData } from "@/ui/models/metrics/metric-data"
import { emptyConversationData, updateConversationData, type ConversationData } from "@/ui/models/actors/conversation-data"
import { eventsWithTimelineFrames, mergeTimeline } from "@/ui/stores/run/timeline"
import { create } from "zustand"
import { appendRetainedEvents, actorEvents, conversationEvents, mergeLiveEvents, metricEvents, stageEvents } from "@/ui/stores/run/event-collections"
import type { GraphTimelineFrame, RunEvent, RunManifest, SimulationState } from "@/shared"

interface RunUiState {
  scenarioBoard: ScenarioBoardState
  selectedRunId?: string
  liveEvents: RunEvent[]
  metricData: MetricData
  conversationData: ConversationData
  metricEvents: RunEvent[]
  actorEvents: RunEvent[]
  conversationEvents: RunEvent[]
  stageEvents: RunEvent[]
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

export const useRunStore = create<RunUiState>((set) => {
  const metricIds = new Set<string>()
  const actorIds = new Set<string>()
  const conversationIds = new Set<string>()
  return {
    scenarioBoard: emptyScenarioBoard(),
    metricData: emptyMetricData(),
    conversationData: emptyConversationData(),
    selectedRunId: undefined,
    liveEvents: [],
    metricEvents: [],
    actorEvents: [],
    conversationEvents: [],
    stageEvents: [],
    timeline: [],
    runState: undefined,
    replayIndex: 0,
    setSelectedRunId: (runId) => set({ selectedRunId: runId }),
    resetLiveState: () => {
      metricIds.clear()
      actorIds.clear()
      conversationIds.clear()
      set({ scenarioBoard: emptyScenarioBoard(), metricData: emptyMetricData(), conversationData: emptyConversationData(), liveEvents: [], metricEvents: [], actorEvents: [], conversationEvents: [], stageEvents: [], timeline: [], runState: undefined, replayIndex: 0 })
    },
    pushEvent: (event) =>
      set((state) => applyEvents(state, [event], metricIds, actorIds, conversationIds)),
    pushEvents: (events) =>
      set((state) => {
        if (!events.length) {
          return state
        }
        return applyEvents(state, events, metricIds, actorIds, conversationIds)
      }),
    setReplayIndex: (index) => set({ replayIndex: index }),
    syncRunDetail: (run, timeline, runState, events) =>
      set((state) => {
        const next = applyEvents(state, events, metricIds, actorIds, conversationIds, runState)
        const nextTimeline = mergeTimeline(next.timeline ?? state.timeline, timeline)
        return { ...next, selectedRunId: state.selectedRunId ?? run.id, timeline: nextTimeline, runState,
          replayIndex: nextTimeline.length ? nextTimeline.length - 1 : 0 }
      }),
  }
})

function applyEvents(state: RunUiState, events: RunEvent[], metricIds: Set<string>, actorIds: Set<string>, conversationIds: Set<string>, runState = state.runState): Partial<RunUiState> {
  const frames = events
    .filter((event): event is Extract<RunEvent, { type: "graph.delta" }> => event.type === "graph.delta")
    .map((event) => event.frame)
  const nextTimeline = mergeTimeline(state.timeline, frames)
  const nextMetricEvents = metricEvents(events)
  const nextActorEvents = actorEvents(events)
  const retainedMetrics = appendRetainedEvents(state.metricEvents, nextMetricEvents, metricIds)
  const retainedConversation = appendRetainedEvents(state.conversationEvents, conversationEvents(events), conversationIds)
  return {
    scenarioBoard: updateScenarioBoard(state.scenarioBoard, events),
    liveEvents: mergeLiveEvents(state.liveEvents, eventsWithTimelineFrames(events, nextTimeline)),
    stageEvents: mergeLiveEvents(state.stageEvents, stageEvents(events)),
    metricEvents: retainedMetrics,
    metricData: appendMetricData(state.metricData, retainedMetrics.slice(state.metricEvents.length)),
    conversationData: updateConversationData(state.conversationData, retainedConversation, retainedConversation.slice(state.conversationEvents.length), runState?.actors),
    actorEvents: nextActorEvents.length ? appendRetainedEvents(state.actorEvents, nextActorEvents, actorIds) : state.actorEvents,
    conversationEvents: retainedConversation,
    timeline: nextTimeline,
    replayIndex: nextTimeline.length ? nextTimeline.length - 1 : state.replayIndex,
  }
}
