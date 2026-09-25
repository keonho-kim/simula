/**
 * Purpose: Decode model-selected event recipients into explicit world actor IDs.
 * Pattern: Pure boundary parser.
 * Usage: Called by Planner event assignment before persisting an accepted audience.
 * Related: src/backend/core/simulation/events/injection.ts
 */
import type { ActorState } from "@/shared"

export function parseEventAudience(text: string, actors: readonly Pick<ActorState, "id">[]): string[] {
  const ids = actors.map(actor => actor.id)
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error("Event assignment requires a nonempty distinct actor roster.")
  const answer = text.trim()
  if (answer === "0") return ids
  if (answer === "?") throw new Error("Event audience is unresolved; identify who actually receives this event under the information rules.")
  if (!/^[1-9]\d*(?:\s*,\s*[1-9]\d*)*$/.test(answer)) {
    throw new Error("Return only 0, ?, or distinct actor numbers separated by commas.")
  }
  const indices = answer.split(",").map(value => Number(value.trim()))
  if (new Set(indices).size !== indices.length || indices.some(index => !Number.isSafeInteger(index) || index > ids.length)) {
    throw new Error("Use distinct actor numbers from the supplied roster.")
  }
  return ids.filter((_, index) => indices.includes(index + 1))
}

export function eventAudienceOptions(actorCount: number): string[] | undefined {
  if (actorCount < 1 || actorCount > 4) return undefined
  const choices = ["0", "?"]
  for (let mask = 1; mask < (1 << actorCount) - 1; mask++) {
    choices.push(Array.from({ length: actorCount }, (_, index) => index + 1)
      .filter(number => mask & (1 << (number - 1))).join(","))
  }
  return choices
}
