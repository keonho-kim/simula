/**
 * Purpose: Select, scope and describe injected simulation events for actor decisions.
 * Pattern: Pure event visibility policy.
 * Usage: Called by coordinator injection and actor context projection.
 * Related: src/backend/core/simulation/actors/memory.ts, src/backend/core/simulation/roles/actor/context.ts
 */
import type { ActorState, InjectedEvent, PlannedEvent, RoundDigest } from "@/shared"

export const UNDISCLOSED_EVENT_TITLE = "Current situation"
export const UNDISCLOSED_EVENT_CONTEXT = "Continue from your visible context."

export function eventVisibleToActor(event: { visibleToActorIds?: readonly string[] }, actorId: string): boolean {
  return event.visibleToActorIds === undefined || event.visibleToActorIds.includes(actorId)
}

export function projectEventForActor(event: PlannedEvent, actorId: string): { event: PlannedEvent; visible: boolean } {
  if (eventVisibleToActor(event, actorId)) return { event, visible: true }
  return { event: { ...event, title: UNDISCLOSED_EVENT_TITLE, summary: UNDISCLOSED_EVENT_CONTEXT }, visible: false }
}

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

export function injectedEventForRound(roundIndex: number, event: PlannedEvent, actors: readonly Pick<ActorState, "id">[]): InjectedEvent {
  const audience = event.visibleToActorIds
  if (audience !== undefined) {
    const actorIds = new Set(actors.map(actor => actor.id))
    if (!audience.length || new Set(audience).size !== audience.length || audience.some(id => !actorIds.has(id))) {
      throw new Error("Injected event audience must contain distinct actors in this world.")
    }
  }
  return {
    id: `round-${roundIndex}-${event.id}`,
    roundIndex,
    sourceEventId: event.id,
    title: event.title,
    summary: event.summary,
    ...(audience === undefined ? {} : { visibleToActorIds: [...audience] }),
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
