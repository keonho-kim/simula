import { describe, expect, test } from "bun:test"
import type { RunEvent } from "@simula/shared"
import { nextRoundContinuation } from "./round-continuation"

const runId = "run-1"
const timestamp = "2026-01-01T00:00:00.000Z"

describe("nextRoundContinuation", () => {
  test("prompts for an unhandled completed round when auto continue is off", () => {
    expect(nextRoundContinuation([runStarted(), roundCompleted(1)], new Set(), false)).toEqual({
      roundIndex: 1,
      mode: "prompt",
    })
  })

  test("auto continues an unhandled completed round when auto continue is on", () => {
    expect(nextRoundContinuation([runStarted(), roundCompleted(1)], new Set(), true)).toEqual({
      roundIndex: 1,
      mode: "auto",
    })
  })

  test("ignores handled and terminal rounds", () => {
    expect(nextRoundContinuation([runStarted(), roundCompleted(1)], new Set([1]), true)).toBeUndefined()
    expect(nextRoundContinuation([runStarted(), roundCompleted(1), runCanceled()], new Set(), true)).toBeUndefined()
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
