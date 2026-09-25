/**
 * Purpose: Verify real provider requests inherit isolated admission and cancellation through LangGraph.
 * Pattern: Controlled HTTP integration test.
 * Usage: bun test src/backend/integrations/llm/admission.test.ts
 * Related: src/backend/integrations/llm/invoke.ts, src/backend/runtime/model-admission.ts
 */
import { expect, test } from "bun:test"
import { Annotation, END, START, StateGraph } from "@langchain/langgraph"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { createGenerationTasks } from "@/backend/core/generation/tasks"
import { resolveRoleSettings } from "@/backend/core/settings"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { z } from "zod"
import { invokeRoleTextWithMetrics } from "./invoke"
import { createGenerationInvocation } from "./generation"
import { modelResourcePool, runWithModelExecution } from "./execution-context"

function controlledProvider(expected: number) {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let received = 0
  let active = 0
  let peak = 0
  const server = Bun.serve({ port: 0, async fetch() {
    received++
    active++
    peak = Math.max(peak, active)
    if (received === expected) entered.resolve()
    await release.promise
    active--
    const chunk = { id: "test", object: "chat.completion.chunk", created: 0, model: "shared-model",
      choices: [{ index: 0, delta: { role: "assistant", content: "ready" }, finish_reason: "stop" }] }
    return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } })
  } })
  const settings = defaultSettings()
  for (const role of ["planner", "actor", "storyBuilder"] as const) {
    settings.roles[role] = { ...settings.roles[role], provider: "vllm", model: "shared-model" }
  }
  settings.providers.vllm = { apiKey: "local-test", baseUrl: `http://127.0.0.1:${server.port}/v1` }
  return { settings, entered, release, received: () => received, peak: () => peak,
    stop: async () => { release.resolve(); await server.stop(true) } }
}

test("50 independent LangGraph executions reach the HTTP adapter before the provider releases them", async () => {
  const provider = controlledProvider(50)
  const admission = new ModelAdmission({ concurrency: 50 })
  const state = Annotation.Root({ output: Annotation<string>() })
  const graph = new StateGraph(state).addNode("call", async () => {
    await Promise.resolve()
    const result = await invokeRoleTextWithMetrics(provider.settings, "storyBuilder", "draft", 1, "World opening")
    return { output: result.text }
  }).addEdge(START, "call").addEdge("call", END).compile()
  const calls = Array.from({ length: 50 }, (_, index) => runWithModelExecution({ owner: `world-${index}`, admission,
    signal: new AbortController().signal }, () => graph.invoke({ output: "" })))
  try {
    await provider.entered.promise
    expect(admission.snapshot().active).toBe(50)
    expect(provider.peak()).toBe(50)
    provider.release.resolve()
    expect((await Promise.all(calls)).every(result => result.output === "ready")).toBe(true)
    expect(admission.snapshot()).toEqual({ active: 0, waiting: 0, pools: 0 })
  } finally { await provider.stop(); await Promise.allSettled(calls) }
})

test("nested parallel calls from different roles share the configured pool allowance", async () => {
  const provider = controlledProvider(2)
  const admission = new ModelAdmission({ concurrency: 2 })
  const calls = ["one", "two", "three"].flatMap(owner => runWithModelExecution({ owner, admission,
    signal: new AbortController().signal }, () => Array.from({ length: 3 }, (_, index) =>
      invokeRoleTextWithMetrics(provider.settings, index % 2 ? "planner" : "actor", "draft", 1, owner))))
  try {
    await provider.entered.promise
    expect(provider.received()).toBe(2)
    expect(admission.snapshot()).toEqual({ active: 2, waiting: 7, pools: 1 })
    provider.release.resolve()
    const results = await Promise.all(calls)
    expect(provider.received()).toBe(9)
    expect(provider.peak()).toBeLessThanOrEqual(2)
    expect(results.every(result => typeof result.metrics.queueWaitMs === "number")).toBe(true)
  } finally { await provider.stop(); await Promise.allSettled(calls) }
})

test("canceling one live scope releases its permit and removes its queued work without canceling a sibling", async () => {
  const provider = controlledProvider(1)
  const admission = new ModelAdmission({ concurrency: 1 })
  const canceled = new AbortController()
  const failures: string[] = []
  const calls = runWithModelExecution({ owner: "canceled", admission, signal: canceled.signal,
    onModelCallFailure: async failure => { failures.push(failure.role) } }, () => [
    invokeRoleTextWithMetrics(provider.settings, "planner", "draft", 1, "first"),
    invokeRoleTextWithMetrics(provider.settings, "actor", "draft", 1, "queued"),
  ])
  const settled = Promise.allSettled(calls)
  const sibling = runWithModelExecution({ owner: "sibling", admission, signal: new AbortController().signal }, () =>
    invokeRoleTextWithMetrics(provider.settings, "actor", "draft", 1, "survivor"))
  try {
    await provider.entered.promise
    canceled.abort(new Error("stop one world"))
    expect((await settled).map(result => result.status)).toEqual(["rejected", "rejected"])
    provider.release.resolve()
    expect((await sibling).text).toBe("ready")
    expect(provider.received()).toBe(2)
    expect(failures).toEqual(["planner"])
    expect(admission.snapshot().pools).toBe(0)
  } finally { await provider.stop(); await settled; await Promise.allSettled([sibling]) }
})

test("equivalent endpoint aliases and credentials do not bypass shared capacity", () => {
  const settings = defaultSettings()
  const config = resolveRoleSettings(settings, "planner")
  expect(modelResourcePool({ ...config, provider: "vllm", model: "m", baseUrl: "http://localhost:8000/v1/", apiKey: "first" }))
    .toBe(modelResourcePool({ ...config, provider: "lmstudio", model: "m", baseUrl: "http://localhost:8000/v1", apiKey: "second" }))
  expect(modelResourcePool({ ...config, provider: "openai", model: "m" }))
    .toBe(modelResourcePool({ ...config, provider: "vllm", model: "m", baseUrl: "https://api.openai.com/v1" }))
})

test("waiting and running notifications bracket actual admission", async () => {
  const provider = controlledProvider(1)
  const admission = new ModelAdmission({ concurrency: 1 })
  const config = resolveRoleSettings(provider.settings, "storyBuilder")
  const blocked = await admission.acquire(modelResourcePool(config), "blocking-world")
  const waiting = Promise.withResolvers<void>()
  const statuses: string[] = []
  const call = runWithModelExecution({ owner: "waiting-world", admission, signal: new AbortController().signal }, () =>
    invokeRoleTextWithMetrics(provider.settings, "storyBuilder", "draft", 1, "Opening", undefined, {
      onAdmission: async status => { statuses.push(status); if (status === "waiting") waiting.resolve() },
    }))
  try {
    await waiting.promise
    expect(statuses).toEqual(["waiting"])
    expect(provider.received()).toBe(0)
    blocked()
    await provider.entered.promise
    expect(statuses).toEqual(["waiting", "running"])
    provider.release.resolve()
    await call
  } finally { blocked(); await provider.stop(); await Promise.allSettled([call]) }
})

test("a provider failure releases its permit without hidden SDK retries", async () => {
  let calls = 0
  const failures: Array<{ role: string; attempt: number; outcome: string }> = []
  const server = Bun.serve({ port: 0, fetch() { calls++; return Response.json({ error: { message: "unavailable" } }, { status: 503 }) } })
  const settings = defaultSettings()
  settings.roles.planner = { ...settings.roles.planner, provider: "vllm", model: "local" }
  settings.providers.vllm = { apiKey: "test", baseUrl: `http://127.0.0.1:${server.port}/v1` }
  const admission = new ModelAdmission({ concurrency: 1 })
  try {
    const failed = runWithModelExecution({ owner: "failed", admission, signal: new AbortController().signal,
      onModelCallFailure: async failure => { failures.push(failure) } }, () =>
      invokeRoleTextWithMetrics(settings, "planner", "draft", 1, "Draft"))
    await expect(failed).rejects.toThrow()
    expect(calls).toBe(1)
    expect(failures).toMatchObject([{ role: "planner", attempt: 1, outcome: "failed" }])
    expect(admission.snapshot()).toEqual({ active: 0, waiting: 0, pools: 0 })
  } finally { await server.stop(true) }
})

test("a plain text task releases admission while waiting to retry a real 503 response", async () => {
  let requests = 0
  const server = Bun.serve({ port: 0, fetch() {
    requests++
    if (requests === 1) return Response.json({ error: { message: "unavailable" } }, { status: 503, headers: { "retry-after": "0" } })
    const chunk = { id: "test", object: "chat.completion.chunk", created: 0, model: "local",
      choices: [{ index: 0, delta: { role: "assistant", content: "A decision is pending." }, finish_reason: "stop" }] }
    return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } })
  } })
  const settings = defaultSettings()
  settings.roles.storyBuilder = { ...settings.roles.storyBuilder, provider: "vllm", model: "local" }
  settings.providers.vllm = { apiKey: "test", baseUrl: `http://127.0.0.1:${server.port}/v1` }
  const admission = new ModelAdmission({ concurrency: 1 })
  const controller = new AbortController()
  const waiting = Promise.withResolvers<void>()
  const releaseWait = Promise.withResolvers<void>()
  const failures: number[] = []
  const invocation = createGenerationInvocation(settings, controller.signal)
  const transportRetry = invocation.transportRetry
  if (!transportRetry) throw new Error("Generation invocation has no retry policy")
  const work = runWithModelExecution({ owner: "retry-world", admission, signal: controller.signal,
    onModelCallFailure: async failure => { failures.push(failure.attempt) } }, () =>
    createGenerationTasks({ language: "en" }, { ...invocation, signal: controller.signal,
      transportRetry: { ...transportRetry, wait: async (_delay, signal) => {
        waiting.resolve()
        await releaseWait.promise
        signal.throwIfAborted()
      } },
      readTask: async () => undefined, saveTask: async () => {}, emit: async () => {},
    }).run({ id: "decision", kind: "facet", instruction: "Describe the decision.", input: {}, evidenceIds: [],
      schema: z.object({ summary: z.string(), evidenceIds: z.array(z.string()) }),
      output: "text", parse: text => ({ summary: text.trim(), evidenceIds: [] }),
      shape: "one complete decision sentence" }))
  try {
    await waiting.promise
    expect(requests).toBe(1)
    expect(admission.snapshot().active).toBe(0)
    releaseWait.resolve()
    expect((await work).summary).toBe("A decision is pending.")
    expect(requests).toBe(2)
    expect(failures).toEqual([1])
    expect(admission.snapshot().active).toBe(0)
  } finally { releaseWait.resolve(); await server.stop(true); await Promise.allSettled([work]) }
})
