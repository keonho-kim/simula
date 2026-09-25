/**
 * Purpose: Persist and validate accepted bounded generation tasks within an owning job directory.
 * Pattern: Shared persistence operations.
 * Usage: Used by scenario-build, world-preparation, and analytical report repositories.
 * Related: src/backend/core/generation/tasks.ts
 */
import type { ExecutionLease } from "./execution-lease"
import { readFile, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import type { AcceptedGenerationTask } from "@/backend/core/generation/tasks"
import { isMissingFileError } from "@/backend/storage/file-errors"

const MAX_TASK_ARTIFACT_BYTES = 256 * 1024
const taskIdSchema = z.string().regex(/^[a-zA-Z0-9-]{1,160}$/)
const taskSchema = z.object({ id: taskIdSchema, fingerprint: z.string().min(1).max(5000), value: z.unknown(), attempt: z.number().int().nonnegative() }).strict()

export async function readGenerationTask(directory: string, taskId: string): Promise<AcceptedGenerationTask | undefined> {
  const path = join(directory, `task-${taskIdSchema.parse(taskId)}.json`)
  try {
    if ((await stat(path)).size > MAX_TASK_ARTIFACT_BYTES) throw new Error("Generation task exceeds its artifact limit.")
    const task = taskSchema.parse(JSON.parse(await readFile(path, "utf8")))
    if (task.id !== taskId) throw new Error("Generation task identity mismatch.")
    return task
  } catch (error) { if (isMissingFileError(error)) return undefined; throw error }
}

export async function saveGenerationTask(directory: string, input: AcceptedGenerationTask, lease: ExecutionLease): Promise<void> {
  const task = taskSchema.parse(input)
  const path = join(directory, `task-${task.id}.json`)
  const text = JSON.stringify(task)
  if (Buffer.byteLength(text) > MAX_TASK_ARTIFACT_BYTES) throw new Error("Generation task exceeds its artifact limit.")
  const temporary = `${path}.${crypto.randomUUID()}.tmp`
  try {
    await writeFile(temporary, text, { flag: "wx" })
    lease.publish(temporary, path)
  } finally { await rm(temporary, { force: true }) }
}
