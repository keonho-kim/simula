import { describe, expect, test } from "bun:test"
import type { RunEvent } from "@simula/shared"
import { dictionary } from "@/lib/i18n"
import { roleSignalButtonClass } from "./activity-rail"
import { buildRoleSummaries } from "./activity-rail/view-model"

const runId = "run-1"
const timestamp = "2026-04-30T00:00:00.000Z"
const t = dictionary.en

describe("activity rail role signals", () => {
  test("marks observer as running between observer start and completion", () => {
    const summaries = buildRoleSummaries([
      nodeStarted("observer", "Observer"),
      modelMetrics("observer", "roundSummary"),
    ], undefined, t)

    expect(summaries.find((summary) => summary.role === "observer")?.status).toBe("running")
  })

  test("marks observer as done after completion", () => {
    const summaries = buildRoleSummaries([
      nodeStarted("observer", "Observer"),
      modelMetrics("observer", "roundSummary"),
      nodeCompleted("observer", "Observer"),
    ], undefined, t)

    expect(summaries.find((summary) => summary.role === "observer")?.status).toBe("done")
  })

  test("uses a green tone for running role cards", () => {
    expect(roleSignalButtonClass("running")).toContain("emerald")
    expect(roleSignalButtonClass("done")).not.toContain("emerald")
  })

  test("collects reasoning as a separate think signal", () => {
    const summaries = buildRoleSummaries([
      modelReasoning("observer", "roundSummary", "hidden thought"),
    ], undefined, t)

    const observer = summaries.find((summary) => summary.role === "observer")
    expect(observer?.reasoning).toHaveLength(1)
    expect(observer?.reasoning[0]?.content).toBe("hidden thought")
    expect(observer?.messages).toHaveLength(0)
  })
})

function nodeStarted(nodeId: string, label: string): RunEvent {
  return { type: "node.started", runId, timestamp, nodeId, label }
}

function nodeCompleted(nodeId: string, label: string): RunEvent {
  return { type: "node.completed", runId, timestamp, nodeId, label }
}

function modelMetrics(role: Extract<RunEvent, { type: "model.metrics" }>["metrics"]["role"], step: Extract<RunEvent, { type: "model.metrics" }>["metrics"]["step"]): RunEvent {
  return {
    type: "model.metrics",
    runId,
    timestamp,
    metrics: {
      role,
      step,
      attempt: 1,
      ttftMs: 10,
      durationMs: 20,
      inputTokens: 30,
      reasoningTokens: 0,
      outputTokens: 10,
      totalTokens: 40,
      tokenSource: "provider",
    },
  }
}

function modelReasoning(role: Extract<RunEvent, { type: "model.reasoning" }>["role"], step: Extract<RunEvent, { type: "model.reasoning" }>["step"], content: string): RunEvent {
  return {
    type: "model.reasoning",
    runId,
    timestamp,
    role,
    step,
    attempt: 1,
    content,
    reasoningTokens: 12,
  }
}
