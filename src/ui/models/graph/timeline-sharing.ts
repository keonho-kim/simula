import type { GraphTimelineFrame } from "@/shared"

// Graph contracts contain scalar fields and small scalar dictionaries, never cyclic objects.
export function sameGraphValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false
  const a = left as Record<string, unknown>
  const b = right as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameGraphValue(a[key], b[key]))
}

function shareItems<T extends { id: string }>(previous: T[], incoming: T[]): T[] {
  if (previous === incoming) return previous
  const byId = new Map(previous.map((item) => [item.id, item]))
  const shared = incoming.map((item) => {
    const old = byId.get(item.id)
    return old && sameGraphValue(old, item) ? old : item
  })
  return shared.length === previous.length && shared.every((item, index) => item === previous[index]) ? previous : shared
}

export function shareTimelineFrame(previous: GraphTimelineFrame | undefined, incoming: GraphTimelineFrame): GraphTimelineFrame {
  if (!previous) return incoming
  return { ...incoming,
    nodes: shareItems(previous.nodes, incoming.nodes),
    edges: shareItems(previous.edges, incoming.edges),
    activeNodeIds: sameGraphValue(previous.activeNodeIds, incoming.activeNodeIds) ? previous.activeNodeIds : incoming.activeNodeIds,
    messages: sameGraphValue(previous.messages, incoming.messages) ? previous.messages : incoming.messages,
    logRefs: sameGraphValue(previous.logRefs, incoming.logRefs) ? previous.logRefs : incoming.logRefs,
  }
}

export function shareTimelineFrames(frames: GraphTimelineFrame[], previous?: GraphTimelineFrame): GraphTimelineFrame[] {
  return frames.map((frame) => { previous = shareTimelineFrame(previous, frame); return previous })
}
