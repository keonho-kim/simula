/**
 * Purpose: Resolve virtual history rows from round offsets without allocating one row per message.
 * Pattern: Pure indexed view.
 * Usage: Built by WindowActorHistory when its round projection changes.
 * Related: src/ui/models/actors/actor-conversation.ts, src/ui/components/actors/history/window-history.tsx
 */
import type { ActorMessage, ActorRound } from "./actor-conversation"

export interface HistoryIndex {
  rounds: ActorRound[]
  starts: number[]
  count: number
}

export interface HistoryRow {
  key: string
  roundIndex: number
  message?: ActorMessage
}

export function buildHistoryIndex(rounds: ActorRound[]): HistoryIndex {
  const starts: number[] = []
  let count = 0
  for (const round of rounds) {
    starts.push(count)
    count += round.messages.length + 1
  }
  return { rounds, starts, count }
}

export function historyRowAt(index: HistoryIndex, position: number): HistoryRow | undefined {
  if (position < 0 || position >= index.count) return undefined
  let low = 0
  let high = index.starts.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (index.starts[middle]! <= position) low = middle
    else high = middle - 1
  }
  const round = index.rounds[low]!
  const message = round.messages[position - index.starts[low]! - 1]
  return { key: message ? `message:${message.id}` : `round:${round.roundIndex}`, roundIndex: round.roundIndex, message }
}
