import type { GraphNodeView, RunEvent } from "@simula/shared"

export function buildActorNameMap(nodes: GraphNodeView[], liveEvents: RunEvent[]): Map<string, string> {
  const names = new Map<string, string>()
  for (const node of nodes) {
    names.set(node.id, node.label)
  }
  for (const event of liveEvents) {
    if (event.type === "actors.ready") {
      for (const actor of event.actors) {
        names.set(actor.id, actor.label)
      }
    }
    if (event.type === "actor.message") {
      names.set(event.actorId, event.actorName)
    }
  }
  return names
}

export function parseActorModelMessage(content: string, actorNames: Map<string, string>): { actorId: string; step: string } | undefined {
  const entries = [...actorNames.entries()].toSorted((a, b) => b[1].length - a[1].length)
  for (const [actorId, name] of entries) {
    if (!content.startsWith(`${name} `)) {
      continue
    }
    const rest = content.slice(name.length + 1)
    const separatorIndex = rest.indexOf(":")
    if (separatorIndex < 1) {
      continue
    }
    return {
      actorId,
      step: rest.slice(0, separatorIndex).trim(),
    }
  }
  return undefined
}

export function signalSymbol(step: string): "!" | "?" {
  return step === "thought" || step === "context" ? "?" : "!"
}

