import type { GraphTimelineFrame, RunEvent } from "@simula/shared"

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
  return (
    event.type === "actors.ready" ||
    event.type === "interaction.recorded" ||
    event.type === "round.completed"
  )
}

