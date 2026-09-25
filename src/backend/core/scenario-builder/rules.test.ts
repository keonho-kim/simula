/**
 * Purpose: Verify one-rule generation, bounded repair, and normalized task reuse.
 * Pattern: Scenario rule contract test.
 * Usage: bun test src/backend/core/scenario-builder/rules.test.ts
 * Related: src/backend/core/scenario-builder/design.ts, src/backend/core/generation/tasks.ts
 */
import { expect, test } from "bun:test"
import { createGenerationTasks, type AcceptedGenerationTask } from "@/backend/core/generation/tasks"
import { parseBuilderRequest } from "./contracts"
import { buildRules } from "./design"

test("an incomplete rule retries only that entry and reuses the assembled result", async () => {
  const stored = new Map<string, AcceptedGenerationTask>()
  stored.set("situation", { id: "situation", fingerprint: "fixture", attempt: 1, value: {
    title: "Budget review", purpose: "Review a proposal.", decision: "Choose the next review step.",
    setting: "A meeting with technical and finance leads.", assumptions: [], evidenceIds: [],
  } })
  stored.set("participant-1", { id: "participant-1", fingerprint: "fixture", attempt: 1, value: {
    id: "participant-1", name: "Technical lead", personality: "Careful", authority: "Advise on schedule.",
    goal: "Find a feasible next step.", evidenceIds: [], nameLocked: true, personalityLocked: false,
  } })
  const calls: string[] = []
  const request = parseBuilderRequest({ documentSetId: "33333333-3333-4333-8333-333333333333", documentRevision: 0,
    language: "en", fastMode: false })
  const tasks = createGenerationTasks(request, {
    modelRevision: "test-model", signal: new AbortController().signal,
    readTask: async id => stored.get(id), saveTask: async task => { stored.set(task.id, task) }, emit: async () => {},
    invoke: async call => {
      calls.push(call.id)
      return { text: call.id === "rule-variation" && call.attempt === 1 ? " "
        : "Keep the approved budget and identities fixed while openings vary.", truncated: false }
    },
  })
  expect(await buildRules(tasks, "situation", ["participant-1"])).toEqual([
    "rule-information", "rule-actions", "rule-termination", "rule-variation",
  ])
  expect(calls.filter(id => id === "rule-variation")).toHaveLength(2)
  for (const id of ["rule-information", "rule-actions", "rule-termination", "rule-variation"]) {
    expect(stored.get(id)?.value).toEqual({ entries: ["Keep the approved budget and identities fixed while openings vary."],
      assumptions: [], evidenceIds: [] })
  }
  const completedCalls = calls.length
  await buildRules(tasks, "situation", ["participant-1"])
  expect(calls).toHaveLength(completedCalls)
})
