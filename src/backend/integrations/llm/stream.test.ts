/**
 * Purpose: Verify bounded provider streams, cancellation, and usage preservation.
 * Pattern: Adapter contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/integrations/llm/stream.ts
 */
import { expect, test } from "bun:test"
import { collectModelStream } from "./stream"
import type { StreamingChatModel } from "./types"

test("streams only within the byte budget and closes an oversized provider response", async () => {
  const deltas: string[] = []
  let closed = false
  const model: StreamingChatModel = {
    async stream() {
      return (async function* () {
        try { yield { content: "가" }; yield { content: "나다" } }
        finally { closed = true }
      })()
    },
  }
  await expect(collectModelStream(model, "question", {
    timeoutMs: 1_000, maxResponseBytes: 6, onDelta: text => { deltas.push(text) },
  })).rejects.toThrow("response byte limit")
  expect(deltas).toEqual(["가"])
  expect(closed).toBe(true)
})

test("aborts a stalled provider and never publishes a late delta", async () => {
  const controller = new AbortController()
  const started = Promise.withResolvers<void>()
  const chunk = Promise.withResolvers<{ content: string }>()
  const deltas: string[] = []
  let providerSignal: AbortSignal | undefined
  const model: StreamingChatModel = {
    async stream(_input, options) {
      providerSignal = options?.signal
      return (async function* () { started.resolve(); yield await chunk.promise })()
    },
  }
  const result = collectModelStream(model, "question", {
    timeoutMs: 1_000, maxResponseBytes: 100, signal: controller.signal,
    onDelta: text => { deltas.push(text) },
  })
  const outcome = result.catch(error => error)
  await started.promise
  controller.abort(new Error("Stopped"))
  expect(await outcome).toMatchObject({ message: "Stopped" })
  expect(providerSignal?.aborted).toBe(true)
  chunk.resolve({ content: "late" })
  await Promise.resolve()
  expect(deltas).toEqual([])
})

test("rejects already canceled input before starting the provider", async () => {
  let calls = 0
  const model: StreamingChatModel = { async stream() { calls++; throw new Error("unexpected call") } }
  await expect(collectModelStream(model, "question", {
    signal: AbortSignal.abort(new Error("Canceled")), timeoutMs: 1_000, maxResponseBytes: 100,
  })).rejects.toThrow("Canceled")
  expect(calls).toBe(0)
})

test("retains finish reasons and usage through metadata-only chunks", async () => {
  const model: StreamingChatModel = {
    async stream() {
      return (async function* () {
        yield { content: "" }
        yield { content: "answer", response_metadata: { finish_reason: "length" },
          usage_metadata: { input_tokens: 5, output_tokens: 3, total_tokens: 8 } }
      })()
    },
  }
  const result = await collectModelStream(model, "question", { timeoutMs: 1_000, maxResponseBytes: 100 })
  expect(result.text).toBe("answer")
  expect(result.diagnostics.finishReason).toBe("length")
  expect(result.usage.totalTokens).toBe(8)
  expect(result.tokenSource).toBe("provider")
})

test("a deadline rejects a provider that stalls before returning a stream", async () => {
  const connection = Promise.withResolvers<AsyncIterable<{ content: string }>>()
  let signal: AbortSignal | undefined
  const model: StreamingChatModel = { async stream(_input, options) { signal = options?.signal; return connection.promise } }
  await expect(collectModelStream(model, "question", { timeoutMs: 10, maxResponseBytes: 100 })).rejects.toThrow("timed out")
  expect(signal?.aborted).toBe(true)
  connection.resolve((async function* () {})())
})

test("reasoning output consumes the same memory limit as visible output", async () => {
  const model: StreamingChatModel = { async stream() {
    return (async function* () { yield { content: "ok", additional_kwargs: { reasoning_content: "internal" } } })()
  } }
  await expect(collectModelStream(model, "question", { timeoutMs: 1_000, maxResponseBytes: 8 })).rejects.toThrow("response byte limit")
})
