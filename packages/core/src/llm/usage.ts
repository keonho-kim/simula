import type { TokenUsage } from "./types"

export function readUsage(value: unknown): TokenUsage | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }
  const usage = value as {
    input_tokens?: unknown
    output_tokens?: unknown
    total_tokens?: unknown
    output_token_details?: { reasoning?: unknown }
    completion_tokens_details?: { reasoning_tokens?: unknown }
    output_tokens_details?: { reasoning_tokens?: unknown }
  }
  const inputTokens = numberOrZero(usage.input_tokens)
  const outputTokens = numberOrZero(usage.output_tokens)
  const reasoningTokens = Math.max(
    numberOrZero(usage.output_token_details?.reasoning),
    numberOrZero(usage.completion_tokens_details?.reasoning_tokens),
    numberOrZero(usage.output_tokens_details?.reasoning_tokens)
  )
  const explicitTotal = numberOrZero(usage.total_tokens)
  const totalTokens = explicitTotal || inputTokens + outputTokens
  if (!inputTokens && !outputTokens && !reasoningTokens && !totalTokens) {
    return undefined
  }
  return { inputTokens, reasoningTokens, outputTokens, totalTokens }
}

export function zeroUsage(): TokenUsage {
  return { inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0 }
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
