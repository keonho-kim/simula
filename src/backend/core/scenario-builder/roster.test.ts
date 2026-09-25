/**
 * Purpose: Verify bounded cast selection, targeted duplicate-name repair and accepted replay.
 * Pattern: Generation use-case test.
 * Usage: bun test src/backend/core/scenario-builder/roster.test.ts
 * Related: src/backend/core/scenario-builder/roster.ts, src/backend/core/generation/tasks.ts
 */
import { expect, test } from "bun:test"
import { createGenerationTasks, type AcceptedGenerationTask } from "@/backend/core/generation/tasks"
import { situationSchema } from "@/shared/scenario-builder-schema"
import { parseBuilderRequest } from "./contracts"
import { buildRoster } from "./roster"

test("a duplicate role repairs only its slot and accepted slots replay without calls", async () => {
  const accepted = new Map<string, AcceptedGenerationTask>()
  const calls: Array<{ id: string; attempt: number; prompt: string }> = []
  const request = parseBuilderRequest({ documentSetId: crypto.randomUUID(), documentRevision: 1, language: "en" })
  const tasks = createGenerationTasks(request, {
    modelRevision: "roster-fixture", signal: new AbortController().signal,
    readTask: async id => accepted.get(id), saveTask: async task => { accepted.set(task.id, task) }, emit: async () => {},
    invoke: async call => {
      calls.push({ id: call.id, attempt: call.attempt, prompt: call.prompt })
      const text = call.id === "roster-count" ? "3" : call.id === "roster-name-1" ? "CFO"
        : call.id === "roster-name-2" && call.attempt === 1 ? "The CFO."
          : call.id === "roster-name-2" ? "Finance"
            : call.attempt === 1 ? "The CFO is needed for this launch decision." : "Operations"
      return { text, truncated: false }
    },
  })
  const situation = situationSchema.parse({ title: "Launch review", purpose: "Review the launch.",
    decision: "Choose launch or delay.", setting: "Planning meeting.", assumptions: [], evidenceIds: [] })
  expect(await buildRoster(tasks, situation)).toEqual(["CFO", "Finance", "Operations"])
  expect(calls.map(call => [call.id, call.attempt])).toEqual([
    ["roster-count", 1], ["roster-name-1", 1], ["roster-name-2", 1], ["roster-name-2", 2],
    ["roster-name-3", 1], ["roster-name-3", 2],
  ])
  expect(calls.every(call => !call.prompt.includes("Required JSON shape"))).toBe(true)
  expect(accepted.get("roster")?.value).toEqual({ names: ["CFO", "Finance", "Operations"] })
  await buildRoster(tasks, situation)
  expect(calls).toHaveLength(6)
})
