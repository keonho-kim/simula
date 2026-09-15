import type { RunEvent } from "@/shared"

export function metricEvents(events: RunEvent[]): RunEvent[] {
  return events.filter((event) => event.type === "model.metrics")
}

export function actorEvents(events: RunEvent[]): RunEvent[] {
  return events.filter(
    (event) =>
      event.type === "actors.ready" ||
      event.type === "interaction.recorded" ||
      event.type === "actor.message" ||
      event.type === "model.reasoning"
  )
}

export function mergeEvents(current: RunEvent[], incoming: RunEvent[]): RunEvent[] {
  if (!incoming.length) return current
  const seen = new Set(current.map(eventKey))
  let merged = current
  for (const event of incoming) {
    const key = eventKey(event)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    if (merged === current) merged = [...current]
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
  if (event.type === "model.reasoning") {
    return `${event.runId}:model.reasoning:${event.role}:${event.step}:${event.attempt}:${event.actorId ?? ""}:${event.timestamp}`
  }
  return `${event.runId}:${event.type}:${event.timestamp}:${JSON.stringify(event)}`
}

export function conversationEvents(events: RunEvent[]): RunEvent[] {
  return events.filter(event => event.type === "actors.ready" || event.type === "interaction.recorded")
}

export function appendRetainedEvents(current: RunEvent[], incoming: RunEvent[], seen: Set<string>): RunEvent[] {
  let next = current
  for (const event of incoming) {
    const key = eventKey(event)
    if (seen.has(key)) continue
    seen.add(key)
    if (next === current) next = [...current]
    next.push(event)
  }
  return next
}

export function mergeLiveEvents(current: RunEvent[], incoming: RunEvent[]): RunEvent[] {
  const merged = mergeEvents(current, incoming)
  return merged === current ? current : merged.slice(-300)
}

export function stageEvents(events: RunEvent[]): RunEvent[] {
  return events.filter(event => event.type !== "board.updated" && event.type !== "model.metrics" && event.type !== "model.reasoning" &&
    event.type !== "log" && event.type !== "graph.delta" && event.type !== "report.delta")
}
