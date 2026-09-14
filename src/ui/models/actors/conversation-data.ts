import type { ActorState, RunEvent } from "@/shared"
import { buildActorRounds, type ActorRound } from "./actor-conversation"

const EMPTY_ACTORS: ActorState[] = []
export interface ConversationData {
  rounds: ActorRound[]
  ready: RunEvent[]
  actors: ActorState[]
}
export function emptyConversationData(): ConversationData {
  return { rounds: [], ready: [], actors: EMPTY_ACTORS }
}

// Metadata changes can rename earlier messages. Ordinary appends only normalize new interactions.
export function updateConversationData(previous: ConversationData, allEvents: RunEvent[], added: RunEvent[], actors = EMPTY_ACTORS): ConversationData {
  const newReady = added.filter((event) => event.type === "actors.ready")
  const ready = newReady.length ? [...previous.ready, ...newReady] : previous.ready
  if (newReady.length || previous.actors !== actors) {
    return { rounds: buildActorRounds(allEvents, actors), ready, actors }
  }
  if (!added.length) return previous
  const additions = buildActorRounds([...ready, ...added], actors)
  if (!additions.length) return previous
  const rounds = new Map(previous.rounds.map((round) => [round.roundIndex, round]))
  for (const round of additions) {
    const existing = rounds.get(round.roundIndex)
    rounds.set(round.roundIndex, existing ? { ...existing, messages: [...existing.messages, ...round.messages] } : round)
  }
  return { rounds: [...rounds.values()].sort((a, b) => a.roundIndex - b.roundIndex), ready, actors }
}

export function roundsThrough(rounds: ActorRound[], cutoff?: string): ActorRound[] {
  if (!cutoff) return rounds
  return rounds.map((round) => ({ ...round, messages: round.messages.filter((message) => message.timestamp <= cutoff) }))
    .filter((round) => round.messages.length > 0)
}
