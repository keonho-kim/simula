/**
 * Purpose: Publish scoped live generation drafts with bounded reconnect snapshots.
 * Pattern: Subscription projection.
 * Usage: Owned by builder and report jobs and consumed by scoped SSE controllers.
 * Related: src/shared/generation.ts, src/backend/api/generation/generation-stream.ts
 */
import type { GenerationEvent, GenerationPreviewDraft, GenerationProgressEvent } from "@/shared/generation"
import { projectGenerationFields } from "@/shared/generation-preview"

const MAX_RECENT_TASKS = 64
type TaskStatus = Extract<GenerationEvent, { type: "task" }>
export class GenerationProgress {
  readonly executionId = crypto.randomUUID()
  private readonly statuses = new Map<string, TaskStatus>()
  private readonly drafts = new Map<string, Extract<GenerationEvent, { type: "draft" }>>()
  private readonly subscribers = new Set<{ taskId?: string; send: (event: GenerationProgressEvent) => void }>()
  private ended = false

  publish(event: GenerationEvent): void {
    if (this.ended) return
    if (event.type === "task") {
      this.statuses.delete(event.taskId)
      this.statuses.set(event.taskId, event)
      if (event.status === "running" || event.status === "completed" || event.status === "failed") this.drafts.delete(event.taskId)
      if (this.statuses.size > MAX_RECENT_TASKS) {
        const selected = new Set([...this.subscribers].map(subscriber => subscriber.taskId))
        const terminal = [...this.statuses.values()].filter(task => task.status === "completed" || task.status === "failed")
        const oldest = terminal.find(task => !selected.has(task.taskId))?.taskId ?? terminal[0]?.taskId ?? this.statuses.keys().next().value
        if (oldest) { this.statuses.delete(oldest); this.drafts.delete(oldest) }
      }
    }
    if (event.type === "draft") {
      if ((this.statuses.get(event.taskId)?.attempt ?? 0) > event.attempt) return
      const previous = this.drafts.get(event.taskId)
      if (previous && previous.attempt === event.attempt && previous.sequence >= event.sequence) return
      this.drafts.set(event.taskId, { ...event, text: previous?.attempt === event.attempt ? previous.text + event.text : event.text })
    }
    let preview: GenerationPreviewDraft | undefined
    for (const subscriber of this.subscribers) {
      if (event.type !== "draft" || subscriber.taskId === event.taskId) {
        const output = event.type === "draft" ? (preview ??= draftPreview(this.drafts.get(event.taskId) ?? event)) : event
        try { subscriber.send({ type: "event", executionId: this.executionId, event: output }) }
        catch { this.subscribers.delete(subscriber) }
      }
    }
  }

  subscribe(taskId: string | undefined, send: (event: GenerationProgressEvent) => void): () => void {
    const subscription = { taskId, send }
    this.subscribers.add(subscription)
    const draft = taskId ? this.drafts.get(taskId) : undefined
    try {
      send({ type: "snapshot", executionId: this.executionId, tasks: [...this.statuses.values()], draft: draft ? draftPreview(draft) : undefined })
      if (this.ended) { send({ type: "terminal", executionId: this.executionId }); this.subscribers.delete(subscription) }
    } catch (error) { this.subscribers.delete(subscription); throw error }
    return () => { this.subscribers.delete(subscription) }
  }

  finish(): void {
    this.ended = true
    for (const subscriber of this.subscribers) {
      try { subscriber.send({ type: "terminal", executionId: this.executionId }) }
      catch { this.subscribers.delete(subscriber) }
    }
    this.subscribers.clear()
    this.drafts.clear()
  }
}

function draftPreview(draft: Extract<GenerationEvent, { type: "draft" }>): GenerationPreviewDraft {
  const { text, ...identity } = draft
  return { ...identity, fields: projectGenerationFields(text) }
}
