import type { RunEvent, SimulationState } from "@/shared"
import { buildActorRounds, type ActorRound } from "@/ui/models/actors/actor-conversation"

export interface ConversationRound extends ActorRound {
  title: string
  summary: string
  events: Array<{ id: string; title: string; status?: string }>
}

/** Project persisted rounds without applying the graph replay cursor or live history limit. */
export function buildConversationBoard(
  state: SimulationState | undefined,
  events: RunEvent[] = []
): ConversationRound[] {
  if (!state) return []
  const history = buildActorRounds(
    state.interactions.map((interaction) => ({
      type: "interaction.recorded",
      runId: state.runId,
      timestamp: "",
      interaction
    })),
    state.actors
  )
  const messages = new Map(history.map((round) => [round.roundIndex, round.messages]))
  const digests = new Map(state.roundDigests.map((round) => [round.roundIndex, round]))
  const reports = new Map(state.roundReports.map((round) => [round.roundIndex, round]))
  const planned = new Map(state.plan?.majorEvents.map((event) => [event.id, event]) ?? [])
  const injected = new Map<number, ConversationRound["events"]>()
  for (const event of events) {
    if (event.type !== "event.injected") continue
    const list = injected.get(event.event.roundIndex) ?? []
    if (!list.some((item) => item.id === event.event.sourceEventId))
      list.push({
        id: event.event.sourceEventId,
        title: event.event.title,
        status: planned.get(event.event.sourceEventId)?.status
      })
    injected.set(event.event.roundIndex, list)
  }
  for (const interaction of state.interactions) {
    const list = injected.get(interaction.roundIndex) ?? []
    const event = planned.get(interaction.eventId)
    if (event && !list.some((item) => item.id === event.id))
      list.push({ id: event.id, title: event.title, status: event.status })
    injected.set(interaction.roundIndex, list)
  }
  const indices = new Set([...messages.keys(), ...digests.keys(), ...reports.keys(), ...injected.keys()])
  return [...indices]
    .sort((a, b) => a - b)
    .map((roundIndex) => ({
      roundIndex,
      title: reports.get(roundIndex)?.title ?? "",
      summary: reports.get(roundIndex)?.roundSummary || digests.get(roundIndex)?.preRound.content || "",
      events: injected.get(roundIndex) ?? [],
      messages: messages.get(roundIndex) ?? []
    }))
}
