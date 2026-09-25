/**
 * Purpose: Classify transient model transport failures and wait outside model admission.
 * Pattern: Provider-boundary retry policy.
 * Usage: Supplied to bounded generation tasks by createGenerationInvocation.
 * Related: src/backend/integrations/llm/generation.ts, src/backend/core/generation/tasks.ts
 */
import { setTimeout as sleep } from "node:timers/promises"

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])
const RETRYABLE_NETWORK_CODE = new Set(["ECONNRESET", "ETIMEDOUT", "EPIPE", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"])
const BASE_RETRY_DELAY_MS = 250
const MAX_DEFAULT_RETRY_DELAY_MS = 2_000
const MAX_PROVIDER_RETRY_DELAY_MS = 30_000

export function transportRetryDelayMs(error: unknown, attempt: number, nowMs = Date.now(), jitter = Math.random()): number | undefined {
  const status = field(error, "status") ?? field(field(error, "response"), "status") ?? field(error, "statusCode")
  const code = field(error, "code") ?? field(field(error, "error"), "code") ?? field(field(error, "cause"), "code")
  const name = field(error, "name")
  const message = field(error, "message")
  if (typeof status === "number") {
    if (!RETRYABLE_STATUS.has(status)) return undefined
    if (status === 429 && (code === "insufficient_quota" || field(error, "rateLimitType") === "stop"
      || name === "RateLimitQuotaExhaustedError")) return undefined
  } else if (!(typeof code === "string" && RETRYABLE_NETWORK_CODE.has(code)
    || name === "APIConnectionError" || message === "Model request timed out.")) return undefined

  const providerDelay = field(error, "retryAfterMs")
  const hinted = typeof providerDelay === "number" ? providerDelay
    : retryAfterMs(field(error, "headers") ?? field(field(error, "response"), "headers"), nowMs)
  if (hinted !== undefined) {
    return Number.isFinite(hinted) && hinted >= 0 && hinted <= MAX_PROVIDER_RETRY_DELAY_MS ? Math.round(hinted) : undefined
  }
  const base = Math.min(MAX_DEFAULT_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 1))
  return Math.round(base * (0.75 + Math.min(1, Math.max(0, jitter)) * 0.5))
}

export async function waitForTransportRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > MAX_PROVIDER_RETRY_DELAY_MS) throw new Error("Invalid model retry delay.")
  signal.throwIfAborted()
  await sleep(delayMs, undefined, { signal })
}

function retryAfterMs(headers: unknown, nowMs: number): number | undefined {
  const getter = field(headers, "get")
  const raw = typeof getter === "function" ? Reflect.apply(getter, headers, ["retry-after"])
    : field(headers, "retry-after") ?? field(headers, "Retry-After")
  if (typeof raw !== "string" || !raw.trim()) return undefined
  const seconds = Number(raw.trim())
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000
  const at = Date.parse(raw)
  return Number.isFinite(at) ? Math.max(0, at - nowMs) : undefined
}

function field(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null && name in value ? Reflect.get(value, name) : undefined
}
