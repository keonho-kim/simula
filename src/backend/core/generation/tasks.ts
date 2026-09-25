/**
 * Purpose: Execute bounded text and choice generation tasks with accepted reuse and targeted retries.
 * Pattern: Task use case with injected I/O.
 * Usage: Used by scenario and world-story graphs with runtime-owned I/O.
 * Related: src/backend/core/generation/validation.ts, src/backend/core/story-builder/world/graph.ts
 */
import { createHash } from "node:crypto"
import { z } from "zod"
import type { ModelMetrics } from "@/shared/run"
import type { GenerationEvent, GenerationTaskKind, GenerationTaskScope } from "@/shared/generation"
import { assertEvidenceReferences } from "./validation"
import { renderPromptBlocks, type PromptBlocks } from "@/backend/core/prompts/blocks"
import { plainTaskPrompt } from "./prompts/plain-task"

const MAX_TASK_ATTEMPTS = 3
const MAX_INPUT_CHARS = 16_000
const MAX_DRAFT_CHARS = 32_000
const DEFAULT_GENERATION_OUTPUT_TOKENS = 2_048
const TASK_CONTRACT_VERSION = 1

export interface GenerationCall {
  id: string
  kind: GenerationTaskKind
  attempt: number
  prompt: string
  maxOutputTokens: number
  evidenceIds: string[]
  signal: AbortSignal
  onDelta: (text: string) => Promise<void>
  onAdmission: (status: "waiting" | "running") => Promise<void>
}
export interface AcceptedGenerationTask { id: string; fingerprint: string; value: unknown; attempt: number }
export interface GenerationDependencies {
  modelRevision: string
  signal: AbortSignal
  readTask: (id: string) => Promise<AcceptedGenerationTask | undefined>
  saveTask: (task: AcceptedGenerationTask) => Promise<void>
  emit: (event: GenerationEvent) => Promise<void>
  invoke: (call: GenerationCall) => Promise<{ text: string; truncated: boolean; metrics?: ModelMetrics }>
  transportRetry?: {
    delayMs: (error: unknown, attempt: number) => number | undefined
    wait: (delayMs: number, signal: AbortSignal) => Promise<void>
  }
}
interface Task<T> {
  id: string
  kind: GenerationTaskKind
  scope?: GenerationTaskScope
  instruction: string
  input: PromptBlocks
  schema: z.ZodType<T>
  shape: string
  evidenceIds: string[]
  outputStyle?: "brief" | "detail"
  output: "choice" | "text"
  parse: (text: string) => T
}

export function createGenerationTasks<Request extends { language: "en" | "ko" }>(request: Request, dependencies: GenerationDependencies) {
  const repairs = new Map<string, string>()
  async function run<T>(task: Task<T>): Promise<T> {
    dependencies.signal.throwIfAborted()
    const aliases = [...new Set(task.evidenceIds)].map((id, index) => [id, `E${index + 1}`] as const)
    const sortedAliases = [...aliases].sort((a, b) => b[0].length - a[0].length)
    const aliasText = (text: string) => sortedAliases.reduce((current, [id, alias]) => current.split(id).join(alias), text)
    const packet = aliasText(renderPromptBlocks(task.input))
    if (packet.length > MAX_INPUT_CHARS) throw new Error(`Generation task ${task.id} exceeds its input budget; split the evidence packet.`)
    const render = (feedback?: string) => plainTaskPrompt({ id: task.id, language: request.language,
      instruction: aliasText(task.instruction), shape: task.shape, packet, mode: task.output,
      detail: task.outputStyle === "detail", feedback: aliasText([repairs.get(task.id), feedback].filter(Boolean).join("; ")) })
    const prompt = render()
    if (prompt.length > MAX_INPUT_CHARS) throw new Error(`Generation task ${task.id} exceeds its complete prompt budget; split the evidence packet.`)
    const fingerprint = createHash("sha256").update(JSON.stringify([TASK_CONTRACT_VERSION, dependencies.modelRevision, prompt, DEFAULT_GENERATION_OUTPUT_TOKENS])).digest("hex")
    const previous = await dependencies.readTask(task.id)
    if (previous?.fingerprint === fingerprint) {
      const parsed = task.schema.safeParse(previous.value)
      if (parsed.success) {
        assertEvidenceReferences(parsed.data, new Set(task.evidenceIds))
        await dependencies.emit({ type: "task", taskId: task.id, kind: task.kind, scope: task.scope, attempt: previous.attempt, status: "completed" })
        return parsed.data
      }
    }
    let feedback = ""
    for (let attempt = 1; attempt <= MAX_TASK_ATTEMPTS; attempt++) {
      dependencies.signal.throwIfAborted()
      const attemptPrompt = feedback ? render(feedback) : prompt
      if (attemptPrompt.length > MAX_INPUT_CHARS) throw new Error(`Generation task ${task.id} exceeds its repair prompt budget.`)
      await dependencies.emit({ type: "task", taskId: task.id, kind: task.kind, scope: task.scope, attempt, status: "running" })
      let draftLength = 0
      let sequence = 0
      let output: Awaited<ReturnType<GenerationDependencies["invoke"]>>
      try {
        output = await dependencies.invoke({
          id: task.id, kind: task.kind, attempt, evidenceIds: task.evidenceIds, signal: dependencies.signal,
          prompt: attemptPrompt,
          maxOutputTokens: DEFAULT_GENERATION_OUTPUT_TOKENS,
          onAdmission: async status => {
            dependencies.signal.throwIfAborted()
            await dependencies.emit({ type: "task", taskId: task.id, kind: task.kind, scope: task.scope, attempt, status })
          },
          onDelta: async text => {
            dependencies.signal.throwIfAborted()
            draftLength += text.length
            if (draftLength > MAX_DRAFT_CHARS) throw new Error("Generation draft exceeded its byte/character budget.")
            await dependencies.emit({ type: "draft", taskId: task.id, attempt, sequence: ++sequence, text })
          },
        })
      } catch (error) {
        dependencies.signal.throwIfAborted()
        const retry = dependencies.transportRetry
        const delayMs = attempt < MAX_TASK_ATTEMPTS ? retry?.delayMs(error, attempt) : undefined
        await dependencies.emit({ type: "task", taskId: task.id, kind: task.kind, scope: task.scope, attempt,
          status: delayMs === undefined ? "failed" : "retrying",
          ...(delayMs === undefined ? { issue: "Model request failed. Check model capacity and provider settings, then retry this task." } : {}) })
        if (delayMs === undefined || !retry) throw error
        await retry.wait(delayMs, dependencies.signal)
        continue
      }
      dependencies.signal.throwIfAborted()
      if (output.metrics) await dependencies.emit({ type: "metrics", taskId: task.id, metrics: output.metrics })
      let value: T
      try {
        if (output.truncated) throw new Error("The response reached its output limit. Return a shorter complete answer.")
        if (output.text.length > MAX_DRAFT_CHARS) throw new Error("Return a shorter complete response.")
        value = task.schema.parse(task.parse(task.output === "text" ? omitAliasCitations(output.text, aliases) : output.text))
        assertEvidenceReferences(value, new Set(task.evidenceIds))
      } catch (error) {
        feedback = error instanceof z.ZodError
          ? error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ").slice(0, 700)
          : error instanceof Error ? error.message.slice(0, 700) : "Return one complete answer."
        await dependencies.emit({ type: "task", taskId: task.id, kind: task.kind, scope: task.scope, attempt,
          status: attempt === MAX_TASK_ATTEMPTS ? "failed" : "retrying", issue: feedback })
        if (attempt === MAX_TASK_ATTEMPTS) throw new Error(`Generation task ${task.id} failed after ${attempt} attempts: ${feedback}`, { cause: error })
        continue
      }
      dependencies.signal.throwIfAborted()
      await dependencies.saveTask({ id: task.id, fingerprint, value, attempt })
      await dependencies.emit({ type: "task", taskId: task.id, kind: task.kind, scope: task.scope, attempt, status: "completed" })
      return value
    }
    throw new Error("Generation task exhausted its attempt budget.")
  }
  async function read<T>(id: string, schema: z.ZodType<T>): Promise<T> {
    dependencies.signal.throwIfAborted()
    const stored = await dependencies.readTask(id)
    if (!stored || stored.id !== id) throw new Error(`Accepted generation task ${id} is unavailable.`)
    return schema.parse(stored.value)
  }
  return { run, read, repairs, dependencies, request }
}

export type GenerationTasks<Request extends { language: "en" | "ko" }> = ReturnType<typeof createGenerationTasks<Request>>

function omitAliasCitations(text: string, aliases: readonly (readonly [string, string])[]): string {
  if (!aliases.length) return text
  const names = aliases.map(([, alias]) => alias).join("|")
  const citation = new RegExp(`[ \\t]*\\((?:${names})(?:[ \\t]*[,;–—-][ \\t]*(?:${names}))*\\)`, "g")
  return text.replace(citation, "")
}

/** Preserve input ordering while giving each free worker another independent task. */
export async function mapGenerationTasks<T, U>(values: readonly T[], fastMode: boolean, work: (value: T, index: number) => Promise<U>): Promise<U[]> {
  const output: U[] = new Array(values.length)
  let next = 0
  let failure: unknown
  let failed = false
  await Promise.all(Array.from({ length: Math.min(values.length, fastMode ? 2 : 1) }, async () => {
    while (!failed) {
      const index = next++
      if (index >= values.length) return
      try { output[index] = await work(values[index], index) }
      catch (error) { failed = true; failure = error }
    }
  }))
  if (failed) throw failure
  return output
}
