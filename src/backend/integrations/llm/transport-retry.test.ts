/**
 * Purpose: Verify bounded provider transport recovery without retrying configuration faults.
 * Pattern: Adapter policy test.
 * Usage: bun test src/backend/integrations/llm/transport-retry.test.ts
 * Related: src/backend/integrations/llm/transport-retry.ts, src/backend/core/generation/tasks.ts
 */
import { expect, test } from "bun:test"
import { transportRetryDelayMs, waitForTransportRetry } from "./transport-retry"

test("uses a bounded jitter delay for transient HTTP and network failures", () => {
  expect(transportRetryDelayMs({ status: 503 }, 1, 0, 0.5)).toBe(250)
  expect(transportRetryDelayMs({ response: { status: 502 } }, 2, 0, 0.5)).toBe(500)
  expect(transportRetryDelayMs({ code: "ECONNRESET" }, 1, 0, 0.5)).toBe(250)
  expect(transportRetryDelayMs(new Error("Model request timed out."), 1, 0, 0.5)).toBe(250)
})

test("honors a short Retry-After hint and rejects delays beyond the retry budget", () => {
  expect(transportRetryDelayMs({ status: 429, headers: { "retry-after": "2" } }, 1, 0, 0.5)).toBe(2_000)
  expect(transportRetryDelayMs({ status: 503, headers: new Headers({ "retry-after": "31" }) }, 1, 0, 0.5)).toBeUndefined()
  expect(transportRetryDelayMs({ status: 429, retryAfterMs: 1_500 }, 1, 0, 0.5)).toBe(1_500)
  const now = Date.parse("2026-09-23T00:00:00.000Z")
  expect(transportRetryDelayMs({ status: 503, headers: { "retry-after": "Wed, 23 Sep 2026 00:00:03 GMT" } }, 1, now, 0.5)).toBe(3_000)
})

test("authentication, exhausted quota, and unknown failures stop immediately", () => {
  expect(transportRetryDelayMs({ status: 401 }, 1, 0, 0.5)).toBeUndefined()
  expect(transportRetryDelayMs({ status: 429, code: "insufficient_quota" }, 1, 0, 0.5)).toBeUndefined()
  expect(transportRetryDelayMs({ status: 429, error: { code: "insufficient_quota" } }, 1, 0, 0.5)).toBeUndefined()
  expect(transportRetryDelayMs({ status: 429, rateLimitType: "stop" }, 1, 0, 0.5)).toBeUndefined()
  expect(transportRetryDelayMs(new Error("invalid schema"), 1, 0, 0.5)).toBeUndefined()
})

test("cancellation interrupts retry waiting", async () => {
  const controller = new AbortController()
  controller.abort(new Error("stop"))
  await expect(waitForTransportRetry(30_000, controller.signal)).rejects.toThrow()
})
