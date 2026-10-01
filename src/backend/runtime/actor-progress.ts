/**
 * Purpose: Retain only the current round's transient actor completion state and notify its viewers.
 * Pattern: Run-scoped subscription owner.
 * Usage: Owned by Subscriptions; updated before persistence only for actor progress events.
 * Related: src/backend/runtime/events.ts, src/backend/api/runs/actor-progress-stream.ts
 */
import type { RunEvent } from "@/shared/run"
import type { ActorProgressSnapshot } from "@/shared/actor-progress"

type Listener = (snapshot: ActorProgressSnapshot) => void
export class ActorProgress {
  private rounds = new Map<string, ActorProgressSnapshot>()
  private listeners = new Map<string, Set<Listener>>()

  snapshot(runId: string) { return this.rounds.get(runId) }
  subscriberCount(runId: string) { return this.listeners.get(runId)?.size ?? 0 }
  publish(event: RunEvent): void {
    if (event.type === "run.started") { this.rounds.delete(event.runId); return }
    const previous = this.rounds.get(event.runId)
    let next: ActorProgressSnapshot
    if (event.type === "actor.progress" && event.update.kind === "round") {
      const update = event.update
      if (previous && previous.roundIndex >= update.roundIndex) return
      next = { runId: event.runId, streamId: previous?.streamId ?? crypto.randomUUID(), revision: (previous?.revision ?? 0) + 1,
        roundIndex: update.roundIndex, parallel: update.parallel, status: "running",
        turns: update.actors.map(actor => ({ actorId: actor.id, actorName: actor.name, status: "waiting", timestamp: event.timestamp })) }
    } else {
      if (!previous) return
      if (event.type === "actor.progress") {
        const update = event.update
        if (update.kind === "round" || update.roundIndex !== previous.roundIndex) return
        const actorId = update.kind === "ready" ? update.message.actorId : update.actorId
        const turn = previous.turns.find(turn => turn.actorId === actorId)
        if (!turn || turn.status === "committed" || turn.status === "ready") return
        next = { ...previous, revision: previous.revision + 1, turns: previous.turns.map(turn => turn.actorId !== actorId ? turn : {
          ...turn, status: update.kind === "ready" ? "ready" : "working", timestamp: event.timestamp,
          ...(update.kind === "ready" ? { message: update.message, order: previous.turns.filter(turn => turn.order !== undefined).length } : {}),
        }) }
      } else if (event.type === "interaction.recorded") {
        if (event.interaction.roundIndex !== previous.roundIndex) return
        next = { ...previous, revision: previous.revision + 1, turns: previous.turns.map(turn => turn.actorId === event.interaction.sourceActorId
          ? { ...turn, status: "committed" } : turn) }
      } else if (event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled") {
        next = { ...previous, revision: previous.revision + 1,
          status: event.type === "run.completed" ? "completed" : event.type === "run.failed" ? "failed" : "canceled" }
      } else return
    }
    if (next.status === "running") this.rounds.set(event.runId, next)
    else this.rounds.delete(event.runId)
    for (const listener of this.listeners.get(event.runId) ?? []) listener(next)
  }
  subscribe(runId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(runId) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(runId, listeners)
    const snapshot = this.rounds.get(runId)
    if (snapshot) listener(snapshot)
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(runId) }
  }
}
