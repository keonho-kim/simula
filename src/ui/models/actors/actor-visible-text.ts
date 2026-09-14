import type { ActorState } from "@/shared"

export function sanitizeActorVisibleText(
  value: string | undefined,
  actorNames: Map<string, string>,
  actors: ActorState[] = []
): string {
  return createActorTextSanitizer(actorNames, actors)(value)
}

export function createActorTextSanitizer(actorNames: Map<string, string>, actors: ActorState[] = []) {
  const replacements = visibleTextReplacements(actorNames, actors)
    .map(([raw, label]) => ({ pattern: new RegExp(escapeRegExp(raw), "g"), label }))
  return (value: string | undefined): string => replacements.reduce(
    (text, { pattern, label }) => text.replace(pattern, label), value?.trim() ?? ""
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
