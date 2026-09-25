/**
 * Purpose: Keep the bounded event summary needed to emit timeline frames without rereading run history.
 * Pattern: Stateful Projector.
 * Usage: One instance per active run in RunStore; accept events in their causal order.
 * Related: src/backend/core/simulation/outputs/timeline.ts, src/backend/storage/runs/run-store.ts
 */
import type { GraphTimelineFrame, RunEvent } from "@/shared"
import { buildRoundTimelineFrame, buildTimelineFrame } from "./timeline"

const MAX_FRAME_MESSAGES = 12
const MAX_FRAME_LOGS = 20

export class TimelineProjector {
  private previous: GraphTimelineFrame | undefined
  private nextIndex = 0
  private readonly messages: string[] = []
  private readonly logRefs: string[] = []
  private readonly activeByRound = new Map<number, Set<string>>()

  accept(event: RunEvent): GraphTimelineFrame | undefined {
    if (event.type === "interaction.recorded" && event.interaction.roundIndex >= 0) {
      this.retain(this.messages, event.interaction.content, MAX_FRAME_MESSAGES)
    } else if (event.type === "actor.message") {
      this.retain(this.messages, `${event.actorName}: ${event.content}`, MAX_FRAME_MESSAGES)
    } else if (event.type === "model.message") {
      this.retain(this.messages, `${event.role}: ${event.content}`, MAX_FRAME_MESSAGES)
    } else if (event.type === "log") {
      this.retain(this.logRefs, event.message, MAX_FRAME_LOGS)
    }

    let frame: GraphTimelineFrame | undefined
    if (event.type === "actors.ready" || event.type === "interaction.recorded") {
      frame = buildTimelineFrame(this.nextIndex, event, this.previous)
      if (event.type === "interaction.recorded") {
        const active = this.activeByRound.get(event.interaction.roundIndex) ?? new Set<string>()
        for (const actorId of frame.activeNodeIds) active.add(actorId)
        this.activeByRound.set(event.interaction.roundIndex, active)
      }
    } else if (event.type === "round.completed") {
      frame = buildRoundTimelineFrame(
        this.nextIndex,
        event,
        this.previous?.nodes.map((node) => ({ ...node })) ?? [],
        this.previous?.edges.map((edge) => ({ ...edge })) ?? [],
        [...(this.activeByRound.get(event.roundIndex) ?? [])],
        this.messages,
        this.logRefs
      )
      this.activeByRound.delete(event.roundIndex)
    }

    if (frame) {
      this.previous = frame
      this.nextIndex += 1
    }
    return frame
  }

  private retain(values: string[], value: string, limit: number): void {
    values.push(value)
    if (values.length > limit) values.shift()
  }
}
