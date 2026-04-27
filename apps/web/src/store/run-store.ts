import { create } from "zustand"
import type { GraphTimelineFrame, RunEvent, RunManifest } from "@simula/shared"

interface RunUiState {
  selectedRunId?: string
  liveEvents: RunEvent[]
  timeline: GraphTimelineFrame[]
  replayIndex: number
  setSelectedRunId: (runId: string | undefined) => void
  resetLiveState: () => void
  pushEvent: (event: RunEvent) => void
  setReplayIndex: (index: number) => void
  syncRunDetail: (run: RunManifest, timeline: GraphTimelineFrame[]) => void
}

export const useRunStore = create<RunUiState>((set) => ({
  selectedRunId: undefined,
  liveEvents: [],
  timeline: [],
  replayIndex: 0,
  setSelectedRunId: (runId) => set({ selectedRunId: runId }),
  resetLiveState: () => set({ liveEvents: [], timeline: [], replayIndex: 0 }),
  pushEvent: (event) =>
    set((state) => {
      const nextTimeline =
        event.type === "graph.delta" ? [...state.timeline, event.frame] : state.timeline
      return {
        liveEvents: [...state.liveEvents, event].slice(-300),
        timeline: nextTimeline,
        replayIndex: nextTimeline.length ? nextTimeline.length - 1 : state.replayIndex,
      }
    }),
  setReplayIndex: (index) => set({ replayIndex: index }),
  syncRunDetail: (run, timeline) =>
    set((state) => ({
      selectedRunId: state.selectedRunId ?? run.id,
      timeline,
      replayIndex: timeline.length ? timeline.length - 1 : 0,
    })),
}))
