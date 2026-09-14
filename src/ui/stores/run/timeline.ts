import { shareTimelineFrames } from "@/ui/models/graph/timeline-sharing"
import type { GraphTimelineFrame, RunEvent } from "@/shared"

// Frames are immutable and ordered by index within one run. Keep existing frame references.
export function mergeTimeline(current: GraphTimelineFrame[], incoming: GraphTimelineFrame[]): GraphTimelineFrame[] {
  if (!incoming.length) return current
  const lastIndex = current.at(-1)?.index ?? -1
  if (incoming.every((frame, index) => frame.index > (incoming[index - 1]?.index ?? lastIndex))) return [...current, ...shareTimelineFrames(incoming, current.at(-1))]
  const known = new Set(current.map((frame) => frame.index))
  const additions = incoming.filter((frame) => {
    if (known.has(frame.index)) return false
    known.add(frame.index)
    return true
  })
  if (!additions.length) return current
  return shareTimelineFrames([...current, ...additions].sort((a, b) => a.index - b.index))
}

// Reuse canonical frames in the live-event window too, so it cannot retain duplicate graph objects.
export function eventsWithTimelineFrames(events: RunEvent[], timeline: GraphTimelineFrame[]): RunEvent[] {
  return events.map((event) => {
    if (event.type !== "graph.delta") return event
    let low = 0
    let high = timeline.length - 1
    while (low <= high) {
      const middle = (low + high) >>> 1
      const frame = timeline[middle]!
      if (frame.index === event.frame.index) return frame === event.frame ? event : { ...event, frame }
      if (frame.index < event.frame.index) low = middle + 1
      else high = middle - 1
    }
    return event
  })
}
