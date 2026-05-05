import type { InjectedEvent, PlannedEvent, RoundDigest } from "@simula/shared"

export function buildPreRoundDigest(roundIndex: number, injectedEvent?: InjectedEvent): RoundDigest {
  const elapsedTime = roundIndex === 1 ? "Opening moment" : `Round ${roundIndex}`
  const content = injectedEvent
    ? `Injected event: ${injectedEvent.title}. ${injectedEvent.summary}`
    : "Actors continue from accumulated context and unresolved pressure."
  return {
    roundIndex,
    preRound: {
      elapsedTime,
      content,
    },
    injectedEventId: injectedEvent?.sourceEventId,
  }
}

export function eventForInjection(value: string, events: PlannedEvent[]): PlannedEvent | undefined {
  return events.find((event) => event.id === value && isInjectableEvent(event))
}

export function injectedEventForRound(roundIndex: number, event: PlannedEvent): InjectedEvent {
  return {
    id: `round-${roundIndex}-${event.id}`,
    roundIndex,
    sourceEventId: event.id,
    title: event.title,
    summary: event.summary,
  }
}

export function continuityEvent(roundIndex: number): PlannedEvent {
  return {
    id: `round-${roundIndex}-continuity`,
    title: "No new major event",
    summary: "Actors continue from accumulated context and unresolved pressure.",
    status: "active",
    participantIds: [],
  }
}

export function selectEventInjection(value: string, events: PlannedEvent[]): string | undefined {
  const selected = value.trim()
  if (selected === "None") {
    return "None"
  }
  const match = events.filter(isInjectableEvent).find((event) => event.id === selected)
  return match?.id
}

export function eventInjectionAllowedOutputs(events: PlannedEvent[]): string[] {
  return [...events.filter(isInjectableEvent).map((event) => event.id), "None"]
}

export function eventInjectionDisplayValue(value: string, events: PlannedEvent[]): string {
  if (value === "None") {
    return "None"
  }
  const event = events.find((item) => item.id === value)
  return event ? `${event.title} (${event.status}). ${event.summary}` : value
}

export function isInjectableEvent(event: PlannedEvent): boolean {
  return event.status === "pending" || event.status === "partial"
}
