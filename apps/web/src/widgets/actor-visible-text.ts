import type { ActorState } from "@simula/shared"

export function sanitizeActorVisibleText(
  value: string | undefined,
  actorNames: Map<string, string>,
  actors: ActorState[] = []
): string {
  const text = value?.trim()
  if (!text) {
    return ""
  }
  return visibleTextReplacements(actorNames, actors).reduce(
    (current, [raw, label]) => current.replace(new RegExp(escapeRegExp(raw), "g"), label),
    text
  )
}

function visibleTextReplacements(actorNames: Map<string, string>, actors: ActorState[]): Array<[string, string]> {
  const replacements = new Map<string, string>()
  for (const actor of actors) {
    for (const action of actor.actions) {
      replacements.set(action.id, action.label)
    }
  }
  for (const [id, name] of actorNames) {
    replacements.set(id, name)
  }
  return [...replacements.entries()].sort((a, b) => b[0].length - a[0].length)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
