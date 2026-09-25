/**
 * Purpose: Verify report synthesis can finish when two accepted child summaries are long.
 * Pattern: Evidence-reduction contract test.
 * Usage: bun test src/backend/core/simulation/outputs/analysis/summaries.test.ts
 * Related: src/backend/core/simulation/outputs/analysis/summaries.ts
 */
import { expect, test } from "bun:test"
import { createGenerationTasks } from "@/backend/core/generation/tasks"
import { reduceSummaries } from "./summaries"

test("a long observation frontier has enough output budget for a complete bounded synthesis", async () => {
  const ids = Array.from({ length: 8 }, (_, index) => `obs-${index + 1}`)
  const summaries = [0, 1].map(index => ({ summary: `World observation ${index + 1}: ` + "A decision remained open after budget discussion. ".repeat(15),
    findings: [], evidenceIds: ids.slice(index * 4, index * 4 + 4) }))
  const calls: number[] = []
  const controller = new AbortController()
  const tasks = createGenerationTasks({ language: "en" as const, fastMode: false }, {
    modelRevision: "long-frontier", signal: controller.signal,
    readTask: async () => undefined, saveTask: async () => {}, emit: async () => {},
    invoke: async call => {
      calls.push(call.maxOutputTokens)
      return call.maxOutputTokens < 2_048 ? { text: "The summary was cut", truncated: true }
        : { text: "Two recorded world summaries show the budget decision remained open.", truncated: false }
    },
  })
  const result = await reduceSummaries(tasks, "world-summary", summaries, new Set(ids), "SIMULATION")
  expect(result.summary).toContain("decision remained open")
  expect(result.evidenceIds).toHaveLength(8)
  expect(calls).toEqual([2_048])
})

test("complete but verbose synthesis stays usable with its observation references", async () => {
  const ids = ["obs-1", "obs-2"]
  const summaries = ids.map((id, index) => ({ summary: `World ${index + 1} records a different response.`,
    findings: [], evidenceIds: [id] }))
  const complete = "World one records a delayed decision. World two records a budget review. "
    + "The simulation remains uncertain and no real-world outcome follows. ".repeat(22)
  const controller = new AbortController()
  const tasks = createGenerationTasks({ language: "en" as const, fastMode: false }, {
    modelRevision: "verbose-frontier", signal: controller.signal,
    readTask: async () => undefined, saveTask: async () => {}, emit: async () => {},
    invoke: async () => ({ text: complete, truncated: false }),
  })
  const result = await reduceSummaries(tasks, "world-summary", summaries, new Set(ids), "SIMULATION")
  expect(result.summary).toBe(complete.trim())
  expect(result.summary).toContain("World two")
  expect(result.evidenceIds).toEqual(ids)
})
