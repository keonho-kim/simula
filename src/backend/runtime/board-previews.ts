import type { RunEvent } from "@/shared"

type BoardEvent = Extract<RunEvent, { type: "board.updated" }>

/** Ephemeral drafts are retained only while their artifact is being generated. */
export class BoardPreviews {
  private drafts = new Map<string, Map<string, BoardEvent>>()
  private listeners = new Map<string, Set<(event: RunEvent) => void>>()

  publish(event: RunEvent): void {
    if (event.type === "board.updated") {
      const value = event.update
      if (value.kind === "preview") {
        const fields = this.drafts.get(event.runId) ?? new Map<string, BoardEvent>()
        const key = value.id + ":" + value.field
        const previous = fields.get(key)?.update
        const content = value.sequence === 0 ? "" : (previous?.kind === "preview" ? previous.content : "") + value.content
        fields.set(key, { ...event, update: { ...value, content, snapshot: true } })
        this.drafts.set(event.runId, fields)
        for (const listener of this.listeners.get(event.runId) ?? []) listener(event)
        return
      }
      const id = value.kind === "digest" ? value.key : value.kind === "actor" ? value.id :
        value.kind === "events" ? "events-pending" : value.kind === "actions" ? "actions-pending" :
        value.kind === "roster" ? "roster-pending" : undefined
      if (id) for (const [key, draft] of this.drafts.get(event.runId) ?? []) {
        if (draft.update.kind === "preview" && draft.update.id === id) this.drafts.get(event.runId)?.delete(key)
      }
    }
    if (["run.started", "run.completed", "run.failed", "run.canceled"].includes(event.type)) this.drafts.delete(event.runId)
  }

  subscribe(runId: string, itemId: string, send: (event: RunEvent) => void): () => void {
    const listener = (event: RunEvent) => {
      if (event.type === "board.updated" && event.update.kind === "preview" && event.update.id === itemId) send(event)
    }
    const listeners = this.listeners.get(runId) ?? new Set()
    listeners.add(listener)
    this.listeners.set(runId, listeners)
    for (const draft of this.drafts.get(runId)?.values() ?? []) listener(draft)
    return () => {
      listeners.delete(listener)
      if (!listeners.size) this.listeners.delete(runId)
    }
  }
}
