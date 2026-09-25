/**
 * Purpose: Verify one bounded attempt ledger across transport recovery and content repair.
 * Pattern: Task contract test.
 * Usage: bun test src/backend/core/generation/tasks.test.ts
 * Related: src/backend/core/generation/tasks.ts, src/backend/integrations/llm/transport-retry.ts
 */
import { expect, test } from "bun:test"
import { z } from "zod"
import type { GenerationEvent } from "@/shared/generation"
import { createGenerationTasks, type GenerationDependencies } from "./tasks"

const task = { id: "one-facet", kind: "facet" as const, instruction: "Describe the decision.", input: {},
  schema: z.object({ summary: z.string().trim().min(1), evidenceIds: z.array(z.string()) }),
  output: "text" as const, parse: (text: string) => ({ summary: text.trim(), evidenceIds: [] }),
  shape: "one complete decision sentence", evidenceIds: [] }
const accepted = "The decision remains pending."

function fixture(invoke: GenerationDependencies["invoke"], controller = new AbortController()) {
  const events: GenerationEvent[] = []
  const waits: number[] = []
  const dependencies: GenerationDependencies = { modelRevision: "test", signal: controller.signal,
    readTask: async () => undefined, saveTask: async () => {}, emit: async event => { events.push(event) }, invoke,
    transportRetry: { delayMs: error => error instanceof Error && "status" in error && error.status === 503 ? 250 : undefined,
      wait: async (delayMs, signal) => { waits.push(delayMs); signal.throwIfAborted() } },
  }
  return { run: () => createGenerationTasks({ language: "en" }, dependencies).run(task), events, waits, controller, dependencies }
}

test("transport retry and incomplete text repair consume the same three-attempt budget", async () => {
  const attempts: number[] = []
  const f = fixture(async call => {
    attempts.push(call.attempt)
    if (call.attempt === 1) throw Object.assign(new Error("unavailable"), { status: 503 })
    return { text: call.attempt === 2 ? "   " : accepted, truncated: false }
  })
  expect((await f.run()).summary).toBe("The decision remains pending.")
  expect(attempts).toEqual([1, 2, 3])
  expect(f.waits).toEqual([250])
  expect(f.events.flatMap(event => event.type === "task" && event.status === "retrying" ? [event.attempt] : [])).toEqual([1, 2])
})

test("a third transient failure stops without a hidden fourth request", async () => {
  const attempts: number[] = []
  const f = fixture(async call => { attempts.push(call.attempt); throw Object.assign(new Error("unavailable"), { status: 503 }) })
  await expect(f.run()).rejects.toThrow("unavailable")
  expect(attempts).toEqual([1, 2, 3])
  expect(f.waits).toEqual([250, 250])
  expect(f.events.some(event => event.type === "task" && event.attempt === 3 && event.status === "failed")).toBe(true)
})

test("configuration errors and cancellation never spend another attempt", async () => {
  const configured: number[] = []
  const invalid = fixture(async call => { configured.push(call.attempt); throw Object.assign(new Error("invalid key"), { status: 401 }) })
  await expect(invalid.run()).rejects.toThrow("invalid key")
  expect(configured).toEqual([1])
  expect(invalid.waits).toEqual([])

  const canceled: number[] = []
  const controller = new AbortController()
  const interrupted = fixture(async call => { canceled.push(call.attempt); throw Object.assign(new Error("unavailable"), { status: 503 }) }, controller)
  const waiting = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  if (!interrupted.dependencies.transportRetry) throw new Error("Missing retry fixture")
  interrupted.dependencies.transportRetry.wait = async (_delay, signal) => {
    waiting.resolve()
    await release.promise
    signal.throwIfAborted()
  }
  const wait = interrupted.run()
  await waiting.promise
  controller.abort(new Error("stop"))
  release.resolve()
  await expect(wait).rejects.toThrow("stop")
  expect(canceled).toEqual([1])
})

test("plain text generation keeps evidence IDs code-owned while aliasing prompt inputs", async () => {
  const id = "9497b7ab-4c15-4b14-8bc6-0bce527aee95:page:1:text:1"
  const prompts: string[] = []
  const f = fixture(async call => {
    prompts.push(call.prompt)
    return { text: "The source supports a launch review.", truncated: false }
  })
  let saved: unknown
  f.dependencies.saveTask = async value => { saved = value }
  const result = await createGenerationTasks({ language: "en" }, f.dependencies).run({ ...task,
    id: "evidence-alias", instruction: `Preserve this required observation: ${id}`,
    parse: text => ({ summary: text.trim(), evidenceIds: [id] }),
    input: { SOURCE: { reference: { id, text: "A launch decision is pending." } } }, evidenceIds: [id] })
  expect(result.evidenceIds).toEqual([id])
  expect(result.summary).toBe("The source supports a launch review.")
  expect(saved).toMatchObject({ value: { evidenceIds: [id] } })
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toContain("E1")
  expect(prompts[0]).not.toContain(id)
})

test("plain tasks render explicit source and simulation blocks without requesting JSON output", async () => {
  let prompt = ""
  const f = fixture(async call => { prompt = call.prompt; return { text: accepted, truncated: false } })
  await createGenerationTasks({ language: "en" }, f.dependencies).run({ ...task,
    input: { SOURCE: { claim: "Projected revenue" }, SIMULATION: { event: "Simulated delay" } } })
  expect(prompt).toContain('<SOURCE>\n{"claim":"Projected revenue"}\n</SOURCE>')
  expect(prompt).toContain('<SIMULATION>\n{"event":"Simulated delay"}\n</SIMULATION>')
  expect(prompt).toContain("no JSON")
  expect(prompt).not.toContain("Required JSON shape")
  expect(prompt).not.toContain("Task input:")
})

test("task-local citation ranges leave generated prose while ordinary source terms remain", async () => {
  const ids = ["source-alpha", "source-beta"]
  const f = fixture(async () => ({ text: "Phase E1 needs evidence (E1–E2).", truncated: false }))
  const value = await createGenerationTasks({ language: "en" }, f.dependencies).run({ ...task,
    evidenceIds: ids, parse: text => ({ summary: text.trim(), evidenceIds: ids }) })
  expect(value.summary).toBe("Phase E1 needs evidence.")
  expect(value.evidenceIds).toEqual(ids)
})
