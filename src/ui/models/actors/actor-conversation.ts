import type { ActorState, Interaction, RunEvent } from "@/shared"
import { createActorTextSanitizer } from "@/ui/models/actors/actor-visible-text"

export interface ActorMessage {
  timestamp: string
  id: string
  actorId: string
  actorName: string
  role: string
  targets: string[]
  thought: string
  action: string
  content: string
  decisionType: Interaction["decisionType"]
}

export interface ActorRound {
  roundIndex: number
  messages: ActorMessage[]
}

export function buildActorRounds(events: RunEvent[], actors: ActorState[] = [], cutoff?: string): ActorRound[] {
  const names = new Map(actors.map(actor => [actor.id, actor.name]))
  const roles = new Map(actors.map(actor => [actor.id, actor.role]))
  for (const event of events) {
    if (event.type !== "actors.ready") continue
    for (const actor of event.actors) {
      names.set(actor.id, actor.label)
      roles.set(actor.id, actor.role)
    }
  }

  const clean = createActorTextSanitizer(names, actors)
  const rounds = new Map<number, ActorRound>()
  const seen = new Set<string>()
  for (const event of events) {
    if (event.type !== "interaction.recorded" || (cutoff && event.timestamp > cutoff)) continue
    const interaction = event.interaction
    if (seen.has(interaction.id)) continue
    seen.add(interaction.id)
    const actorName = names.get(interaction.sourceActorId) ?? interaction.sourceActorId
    const content = clean(interaction.content)
    const round = rounds.get(interaction.roundIndex) ?? { roundIndex: interaction.roundIndex, messages: [] }
    round.messages.push({
      timestamp: event.timestamp,
      id: interaction.id,
      actorId: interaction.sourceActorId,
      actorName,
      role: roles.get(interaction.sourceActorId) ?? "",
      targets: interaction.targetActorIds.map(id => names.get(id) ?? id),
      thought: clean(interaction.thought),
      action: clean(interaction.actionType),
      content: content.startsWith(`${actorName}: `) ? content.slice(actorName.length + 2) : content,
      decisionType: interaction.decisionType,
    })
    rounds.set(round.roundIndex, round)
  }
  return [...rounds.values()].sort((a, b) => a.roundIndex - b.roundIndex)
}
