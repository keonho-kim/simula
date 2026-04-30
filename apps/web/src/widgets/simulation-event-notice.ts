import type { InjectedEvent, RunEvent } from "@simula/shared"

export interface SimulationEventNotice {
  event: InjectedEvent
}

export function buildSimulationEventNotice(events: RunEvent[]): SimulationEventNotice | undefined {
  const injectedIndex = lastIndexOf(events, (event) => event.type === "event.injected")
  if (injectedIndex < 0) {
    return undefined
  }

  const injected = events[injectedIndex]
  if (!injected || injected.type !== "event.injected") {
    return undefined
  }
  const laterEvents = events.slice(injectedIndex + 1)
  const hidden = laterEvents.some(
    (event) =>
      event.type === "interaction.recorded" ||
      event.type === "round.completed" ||
      event.type === "event.injected" ||
      event.type === "run.completed" ||
      event.type === "run.failed" ||
      event.type === "run.canceled"
  )
  return hidden ? undefined : { event: injected.event }
}

function lastIndexOf<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index] as T)) {
      return index
    }
  }
  return -1
}
