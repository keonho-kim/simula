import { describe, expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { dictionary } from "@/ui/i18n/dictionary"
import { buildRoleDiagnostics, roleLabel } from "@/ui/models/report/role-diagnostics"

describe("report view model", () => {
  test("summarizes system role diagnostics without exposing raw model output", () => {
    const events: RunEvent[] = [
      {
        type: "model.message",
        runId: "run-1",
        timestamp: "2026-04-28T00:00:00.000Z",
        role: "planner",
        content: "{\"raw\":\"secret planner chain\"}",
      },
      {
        type: "model.metrics",
        runId: "run-1",
        timestamp: "2026-04-28T00:00:01.000Z",
        metrics: {
          role: "planner",
          step: "coreSituation",
          attempt: 1,
          ttftMs: 10,
          durationMs: 30,
          inputTokens: 100,
          reasoningTokens: 12,
          outputTokens: 20,
          totalTokens: 120,
          tokenSource: "provider",
        },
      },
      {
        type: "model.reasoning",
        runId: "run-1",
        timestamp: "2026-04-28T00:00:01.500Z",
        role: "planner",
        step: "coreSituation",
        attempt: 1,
        content: "secret planner chain",
        reasoningTokens: 12,
      },
      {
        type: "node.completed",
        runId: "run-1",
        timestamp: "2026-04-28T00:00:02.000Z",
        nodeId: "coordinator",
        label: "Coordinator",
      },
      {
        type: "log",
        runId: "run-1",
        timestamp: "2026-04-28T00:00:03.000Z",
        level: "info",
        message: "observer summarized round 1",
      },
    ]

    const diagnostics = buildRoleDiagnostics(events)
    const bodies = diagnostics.map(event => event.body).join("\n")
    expect(diagnostics.some(event => event.kind === "think" && event.details === "secret planner chain")).toBe(true)
    expect(diagnostics.filter(event => event.role === "planner" && event.kind === "metric")).toHaveLength(1)
    expect(diagnostics.filter(event => event.role === "coordinator" && event.kind === "node")).toHaveLength(1)
    expect(diagnostics.filter(event => event.role === "observer" && event.kind === "log")).toHaveLength(1)
    expect(bodies).not.toContain("secret planner chain")
    expect(bodies).not.toContain("{\"raw\"")
  })

  test("localizes report role labels", () => {
    expect(roleLabel("actor", dictionary.ko)).toBe("인물")
    expect(roleLabel("coordinator", dictionary.ko)).toBe("진행")
  })
})
