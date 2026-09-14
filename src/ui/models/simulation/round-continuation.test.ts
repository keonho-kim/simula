import { describe, expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { nextRoundContinuation } from "@/ui/models/simulation/round-continuation"

const runId = "run-1"
const timestamp = "2026-01-01T00:00:00.000Z"

describe("nextRoundContinuation", () => {
  test("returns an unhandled completed round for confirmation", () => {
    expect(nextRoundContinuation([runStarted(), roundCompleted(1)], new Set())).toBe(1)
  })

  test("ignores handled and terminal rounds", () => {
    expect(nextRoundContinuation([runStarted(), roundCompleted(1)], new Set([1]))).toBeUndefined()
    expect(nextRoundContinuation([runStarted(), roundCompleted(1), runCanceled()], new Set())).toBeUndefined()
  })
})

function runStarted(): RunEvent {
  return { type: "run.started", runId, timestamp }
}

function roundCompleted(roundIndex: number): RunEvent {
  return { type: "round.completed", runId, timestamp, roundIndex }
}

function runCanceled(): RunEvent {
  return { type: "run.canceled", runId, timestamp }
}
