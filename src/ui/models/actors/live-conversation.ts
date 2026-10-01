/**
 * Purpose: Overlay transient previews on confirmed history while preserving visible arrival order.
 * Pattern: Pure presentation projection.
 * Usage: ActorRail reconciles current-round progress; reports use only confirmed rounds.
 * Related: src/ui/models/actors/actor-conversation.ts, src/ui/hooks/use-actor-progress.ts
 */
import type { ActorProgressSnapshot } from "@/shared/actor-progress"
import type { ActorMessage, ActorRound } from "./actor-conversation"

interface LiveRound extends ActorRound { confirmed?: ActorRound; progressKey?: string }
export function reconcileLiveConversation(previous: LiveRound[], confirmed: ActorRound[], progress?: ActorProgressSnapshot): LiveRound[] {
  const prior = new Map(previous.map(round => [round.roundIndex, round]))
  const current = new Map(confirmed.map(round => [round.roundIndex, round]))
  for (const round of previous) if (!current.has(round.roundIndex)) current.set(round.roundIndex, round.confirmed ?? { roundIndex: round.roundIndex, messages: [] })
  const unapplied = progress?.status === "failed" || progress?.status === "canceled"
  if (progress?.roundIndex && !current.has(progress.roundIndex)) current.set(progress.roundIndex, { roundIndex: progress.roundIndex, messages: [] })
  const result = [...current.values()].sort((a, b) => a.roundIndex - b.roundIndex).map(round => {
    const before = prior.get(round.roundIndex)
    const progressKey = progress?.roundIndex === round.roundIndex ? `${progress.streamId}:${progress.revision}:${progress.status}` : unapplied ? progress.status : undefined
    if (before?.confirmed === round && before.progressKey === progressKey) return before
    const messages = new Map<string, ActorMessage>()
    const beforeMessages = new Map(before?.messages.map(message => [message.id, message]))
    for (const message of before?.messages ?? []) {
      if (message.delivery) messages.set(message.id, unapplied && message.delivery === "pending" ? { ...message, delivery: "unapplied" } : message)
    }
    if (progress?.roundIndex === round.roundIndex) {
      const turns = progress.turns.filter(turn => turn.message).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      for (const turn of turns) {
        const value = turn.message
        if (!value) continue
        const content = value.content.startsWith(`${value.actorName}: `) ? value.content.slice(value.actorName.length + 2) : value.content
        const candidate: ActorMessage = { ...value, content, timestamp: turn.timestamp, thought: "",
          delivery: progress.status === "failed" || progress.status === "canceled" ? "unapplied" : "pending" }
        const old = beforeMessages.get(value.id)
        messages.set(value.id, old && old.delivery === candidate.delivery && old.content === content ? old : candidate)
      }
    }
    // Saved interactions always win, even when their stream overtakes the preview stream.
    for (const message of round.messages) messages.set(message.id, message)
    const ordered: ActorMessage[] = []
    for (const old of before?.messages ?? []) {
      const message = messages.get(old.id)
      if (message) { ordered.push(message); messages.delete(old.id) }
    }
    ordered.push(...messages.values())
    return { roundIndex: round.roundIndex, confirmed: round, progressKey,
      messages: before && ordered.length === before.messages.length && ordered.every((message, index) => message === before.messages[index])
        ? before.messages : ordered }

  })
  return result.length === previous.length && result.every((round, index) => round === previous[index]) ? previous : result
}
