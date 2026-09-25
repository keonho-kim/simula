/**
 * Purpose: Collect provider output with bounded memory, cancellation, and a total deadline.
 * Pattern: Streaming adapter.
 * Usage: Invoked by the role call adapter with a configured streaming model.
 * Related: src/backend/integrations/llm/invoke.ts, src/backend/integrations/llm/diagnostics.ts
 */
import { contentToText } from "./content"
import { readFinishReason, readReasoningContent } from "./diagnostics"
import { readUsage, zeroUsage } from "./usage"
import type { ChatInput, StreamingChatModel, TokenUsage } from "./types"

export const DEFAULT_RESPONSE_BYTE_LIMIT = 128 * 1024

export interface ModelStreamOptions {
  timeoutMs: number
  maxResponseBytes: number
  signal?: AbortSignal
  onDelta?: (text: string) => Promise<void> | void
}

export async function collectModelStream(model: StreamingChatModel, input: ChatInput, options: ModelStreamOptions) {
  if (!Number.isSafeInteger(options.maxResponseBytes) || options.maxResponseBytes < 1) {
    throw new Error("Model response byte limit must be a positive integer.")
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("Model timeout must be positive.")
  }
  options.signal?.throwIfAborted()
  const controller = new AbortController()
  const abort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener("abort", abort, { once: true })
  const timeout = setTimeout(() => controller.abort(new Error("Model request timed out.")), options.timeoutMs)
  try {
    // Race the whole operation so an endpoint that ignores cancellation cannot hold
    // the caller indefinitely. The collector checks the signal before every callback.
    return await untilAborted(collect(model, input, options, controller.signal), controller.signal)
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener("abort", abort)
    controller.abort()
  }
}

async function collect(model: StreamingChatModel, input: ChatInput, options: ModelStreamOptions, signal: AbortSignal) {
  const startedAt = performance.now()
  let text = ""
  let firstChunkAt: number | undefined
  let usage: TokenUsage | undefined
  let reasoningContent = ""
  let finishReason: string | undefined
  let responseBytes = 0
  const encoder = new TextEncoder()
  for await (const chunk of await model.stream(input, { signal })) {
    signal.throwIfAborted()
    const delta = contentToText(chunk.content)
    const reasoning = readReasoningContent(chunk)
    responseBytes += encoder.encode(delta).byteLength + encoder.encode(reasoning).byteLength
    if (responseBytes > options.maxResponseBytes) {
      throw new Error("Model response byte limit exceeded; reduce the generation unit.")
    }
    firstChunkAt ??= performance.now()
    text += delta
    reasoningContent += reasoning
    usage = readUsage(chunk.usage_metadata) ?? usage
    finishReason = readFinishReason(chunk) ?? finishReason
    if (delta) await options.onDelta?.(delta)
  }
  signal.throwIfAborted()
  const completedAt = performance.now()
  return {
    text: text.trim(),
    usage: usage ?? zeroUsage(),
    tokenSource: usage ? "provider" as const : "unavailable" as const,
    ttftMs: Math.max(0, Math.round((firstChunkAt ?? completedAt) - startedAt)),
    durationMs: Math.max(0, Math.round(completedAt - startedAt)),
    diagnostics: {
      reasoningContentObserved: Boolean(reasoningContent.trim()),
      reasoningContent: reasoningContent.trim(),
      finishReason,
    },
  }
}

function untilAborted<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
  })
}
