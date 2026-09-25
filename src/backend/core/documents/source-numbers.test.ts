/**
 * Purpose: Verify cited-number matching across common document number formats.
 * Pattern: Pure validation contract test.
 * Usage: bun test src/backend/core/documents/source-numbers.test.ts
 * Related: src/backend/core/documents/source-numbers.ts
 */
import { expect, test } from "bun:test"
import { unsupportedSourceNumbers } from "./source-numbers"

test("accepts equivalent thousands separators and zero-padded dates", () => {
  expect(unsupportedSourceNumbers("Launch: 2026년 1월 2일. Budget: 1200.",
    "Launch: 2026-01-02. Budget: 1,200.")).toEqual([])
})

test("preserves sign and percent meaning while returning only unsupported numbers", () => {
  expect(unsupportedSourceNumbers("Revenue -20, margin 20%, budget 999", "Revenue 20, margin 20, budget 120"))
    .toEqual(["-20", "20%", "999"])
})

test("checks values directly followed by Korean units without treating action codes as quantities", () => {
  expect(unsupportedSourceNumbers("예산 999억 원, 행동 PRV01", "예산 120억 원, 행동 PRV01")).toEqual(["999"])
})
