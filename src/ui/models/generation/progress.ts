/**
 * Purpose: Validate and reduce scoped generation progress into bounded browser previews.
 * Pattern: Pure reducer and presentation projection.
 * Usage: Consumed by the common generation stream hook and task panels.
 * Related: src/ui/hooks/use-generation-stream.ts
 */
import { z } from "zod"
import { GENERATION_TASK_KINDS } from "@/shared/generation"

const MAX_RECENT_TASKS = 64
const id = z.string().regex(/^[a-zA-Z0-9-]{1,160}$/)
const attempt = z.number().int().positive()
const scope = z.discriminatedUnion("kind", [z.object({ kind: z.literal("document"), id: z.uuid() }), z.object({ kind: z.literal("participant"), name: z.string().max(80) }), z.object({ kind: z.enum(["facet", "rule"]), key: z.string().max(80) })])
const task = z.object({ type: z.literal("task"), taskId: id,
  kind: z.enum(GENERATION_TASK_KINDS),
  scope: scope.optional(), attempt, status: z.enum(["waiting", "running", "retrying", "completed", "failed"]), issue: z.string().max(1000).optional() })
const draft = z.object({ type: z.literal("draft"), taskId: id, attempt, sequence: z.number().int().positive(), fields: z.array(z.object({ key: z.string().max(80), text: z.string().max(8000) })).max(64) })
const envelope = z.discriminatedUnion("type", [
  z.object({ type: z.literal("snapshot"), executionId: z.uuid(), tasks: z.array(task).max(MAX_RECENT_TASKS), draft: draft.optional() }),
  z.object({ type: z.literal("event"), executionId: z.uuid(), event: z.discriminatedUnion("type", [task, draft, z.object({ type: z.literal("metrics") })]) }),
  z.object({ type: z.literal("terminal"), executionId: z.uuid() }),
])
export type GenerationTaskView = z.infer<typeof task>
export interface GenerationProgressView {
  executionId?: string
  tasks: GenerationTaskView[]
  draft?: z.infer<typeof draft>
  resync: boolean
  terminal: boolean
}
export function emptyGenerationProgress(): GenerationProgressView { return { tasks: [], resync: false, terminal: false } }

export function reduceGenerationProgress(state: GenerationProgressView, input: unknown): GenerationProgressView {
  const parsed = envelope.safeParse(input)
  if (!parsed.success) return { ...state, resync: true }
  const value = parsed.data
  if (value.type === "snapshot") return { executionId: value.executionId, tasks: value.tasks, draft: value.draft, resync: false, terminal: false }
  if (state.executionId !== value.executionId) return state
  if (value.type === "terminal") return { ...state, terminal: true }
  const event = value.event
  if (event.type === "metrics") return state
  const previous = state.tasks.find(value => value.taskId === event.taskId)
  if (previous && previous.attempt > event.attempt) return state
  if (event.type === "task") {
    const tasks = [...state.tasks.filter(value => value.taskId !== event.taskId), event]
    if (tasks.length > MAX_RECENT_TASKS) {
      const terminal = tasks.findIndex(task => task.status === "completed" || task.status === "failed")
      tasks.splice(terminal < 0 ? 0 : terminal, 1)
    }
    return { ...state, tasks,
    draft: state.draft?.taskId === event.taskId && (event.attempt > state.draft.attempt || event.status === "completed") ? undefined : state.draft,
    }
  }
  const old = state.draft?.taskId === event.taskId && state.draft.attempt === event.attempt ? state.draft : undefined
  if (old && old.sequence >= event.sequence) return state
  if (event.sequence !== (old?.sequence ?? 0) + 1) return { ...state, resync: true }
  return { ...state, draft: event }
}
