import type { GraphTimelineFrame, RunEvent } from "@simula/shared"

const TIMELINE_FRAME_EVENT_TYPES = new Set<RunEvent["type"]>([
  "actors.ready",
  "interaction.recorded",
  "round.completed",
])

export function cloneTimeline(timeline: GraphTimelineFrame[]): GraphTimelineFrame[] {
  return timeline.map((frame) => ({
    ...frame,
    nodes: frame.nodes.map((node) => ({ ...node })),
    edges: frame.edges.map((edge) => ({ ...edge })),
    activeNodeIds: [...frame.activeNodeIds],
    messages: [...frame.messages],
    logRefs: [...frame.logRefs],
  }))
}

export function createsTimelineFrame(event: RunEvent): boolean {
  return TIMELINE_FRAME_EVENT_TYPES.has(event.type)
}
