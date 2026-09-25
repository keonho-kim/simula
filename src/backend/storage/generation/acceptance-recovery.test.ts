/**
 * Purpose: Verify accepted task publication survives a lost completion notification and worker replacement.
 * Pattern: Storage and generation recovery contract test.
 * Usage: bun test src/backend/storage/generation/acceptance-recovery.test.ts
 * Related: src/backend/storage/generation/task-artifacts.ts, src/backend/core/generation/tasks.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { z } from "zod"
import { createGenerationTasks } from "@/backend/core/generation/tasks"
import { readGenerationTask, saveGenerationTask } from "./task-artifacts"
import { ExecutionOwnership } from "./execution-lease"

test("a new owner reuses accepted output after completion publication was interrupted", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-accepted-recovery-"))
  try {
    const first = new ExecutionOwnership(root).claim()
    if (!first) throw new Error("Missing first claim")
    const task = { id: "one-facet", kind: "facet" as const, instruction: "Describe the decision.", input: {},
      schema: z.object({ summary: z.string(), evidenceIds: z.array(z.string()) }),
      output: "text" as const, parse: (text: string) => ({ summary: text.trim(), evidenceIds: [] }),
      shape: "one complete decision sentence", evidenceIds: [] }
    const result = { summary: "The decision remains pending.", evidenceIds: [] }
    let calls = 0
    const shared = { modelRevision: "test", signal: new AbortController().signal,
      readTask: (id: string) => readGenerationTask(root, id),
      invoke: async () => { calls++; return { text: result.summary, truncated: false } },
    }
    const interrupted = createGenerationTasks({ language: "en" }, { ...shared,
      saveTask: task => saveGenerationTask(root, task, first),
      emit: async event => { if (event.type === "task" && event.status === "completed") throw new Error("Completion notification lost") },
    })
    await expect(interrupted.run(task)).rejects.toThrow("notification lost")
    expect((await readGenerationTask(root, task.id))?.value).toEqual(result)
    const replacement = new ExecutionOwnership(root, () => first.expiresAt + 1).claim()
    if (!replacement) throw new Error("Missing replacement claim")
    const resumed = createGenerationTasks({ language: "en" }, { ...shared,
      saveTask: task => saveGenerationTask(root, task, replacement), emit: async () => {},
    })
    expect(await resumed.run(task)).toEqual(result)
    expect(calls).toBe(1)
    first.release(); replacement.release()
  } finally { await rm(root, { recursive: true, force: true }) }
})
