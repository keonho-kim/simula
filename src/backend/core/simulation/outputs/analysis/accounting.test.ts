/**
 * Purpose: Verify scoped model calls never turn missing provider usage into zero.
 * Pattern: Pure projection contract test.
 * Usage: bun test src/backend/core/simulation/outputs/analysis/accounting.test.ts
 * Related: src/backend/core/simulation/outputs/analysis/accounting.ts, src/shared/analytical-report.ts
 */
import { expect, test } from "bun:test"
import { combineUsage, summarizeUsage } from "./accounting"

const measure = (tokens: number, tokenSource: "provider" | "unavailable" = "provider") => ({
  durationMs: 20, queueWaitMs: 3, inputTokens: tokens, reasoningTokens: 0,
  outputTokens: 5, totalTokens: tokens + 5, tokenSource,
})

test("known calls aggregate duration while unknown token usage stays unavailable", () => {
  const shared = summarizeUsage([measure(10)])
  const world = summarizeUsage([measure(0, "unavailable"), measure(20)])
  const overall = combineUsage([shared, world])
  expect(overall).toMatchObject({ calls: 3, observedCalls: 3, durationMs: 60, queueWaitMs: 9,
    inputTokens: null, totalTokens: null, unavailableTokenCalls: 1 })
  expect(shared).toMatchObject({ calls: 1, inputTokens: 10, totalTokens: 15 })
})

test("a missing scope is unknown while an observed empty scope is zero", () => {
  const unavailable = summarizeUsage(undefined)
  const empty = summarizeUsage([])
  expect(unavailable).toMatchObject({ calls: null, durationMs: null, totalTokens: null })
  expect(empty).toMatchObject({ calls: 0, durationMs: 0, totalTokens: 0 })
  expect(combineUsage([empty, unavailable])).toMatchObject({ calls: null, observedCalls: 0, totalTokens: null })
})

test("a failed admitted request counts as incurred work with unknown usage", () => {
  expect(summarizeUsage([measure(10)], 1)).toMatchObject({ calls: 2, observedCalls: 2,
    durationMs: null, queueWaitMs: null, totalTokens: null, unavailableTokenCalls: 1 })
  expect(summarizeUsage([measure(10)], null)).toMatchObject({ calls: null, observedCalls: 1, totalTokens: null })
})
