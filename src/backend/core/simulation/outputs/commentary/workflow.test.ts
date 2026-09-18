import type { ReportCommentary } from "@/shared"
import { expect, spyOn, test } from "bun:test"
import * as invocation from "@/backend/integrations/llm/invoke"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { parseScenarioDocument } from "@/backend/core/scenario"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { generateReportCommentary } from "./workflow"

test("frontiers finish before parent synthesis, concurrency is bounded and failed leaves remain retryable", async () => {
  const state = initialSimulationState("r", parseScenarioDocument("---\nnum_cast: 2\n---\n검토"))
  state.scenario.language = "ko"
  state.roundReports = Array.from({ length: 6 }, (_, index) => ({
    roundIndex: index + 1,
    title: "회의",
    roundSummary: "조건을 논의했다"
  }))
  let active = 0,
    peak = 0
  const calls: string[] = []
  let fail = true
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(
    async (_settings, _role, _step, _attempt, prompt) => {
      const input = String(prompt)
      const id = input.match(/Node: (.+)/)?.[1] ?? ""
      calls.push(id)
      active++
      peak = Math.max(peak, active)
      await Promise.resolve()
      active--
      const allowed: string[] = JSON.parse(input.match(/Evidence IDs: (.+)/)?.[1] ?? "[]")
      return {
        text:
          fail && id === "round-2"
            ? "broken"
            : JSON.stringify({
                summary: "시나리오의 제약 때문에 협의가 지연됐다",
                findings: ["주어진 기록에서 의견 차이가 확인된다"],
                conclusion: "다음 합의 여부는 불확실하다",
                evidenceIds: allowed.slice(0, 1)
              }),
        metrics: {
          role: "observer",
          step: "reportCommentary",
          attempt: 1,
          ttftMs: 0,
          durationMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          totalTokens: 0,
          tokenSource: "unavailable"
        },
        diagnostics: { reasoningContentObserved: false, reasoningContent: "" }
      }
    }
  )
  try {
    const partial = await generateReportCommentary(state, defaultSettings(), async () => {})
    expect(peak).toBe(2)
    expect(partial.status).toBe("partial")
    expect(partial.nodes.find((node) => node.id === "round-2")?.status).toBe("failed")
    expect(calls.filter((id) => id === "round-2")).toHaveLength(3)
    expect(calls.indexOf("branch-1-0")).toBeGreaterThan(calls.lastIndexOf("round-6"))
    fail = false
    calls.length = 0
    let checkpoint: ReportCommentary | undefined
    await expect(generateReportCommentary({ ...state, reportCommentary: partial }, defaultSettings(), async () => {}, undefined, async value => {
      if (value.status === "running" && value.nodes.find(node => node.id === "round-2")?.status === "ready") {
        checkpoint = value
        throw new Error("checkpoint interruption")
      }
    })).rejects.toThrow("checkpoint interruption")
    expect(checkpoint?.nodes.find(node => node.id === partial.rootId)?.status).toBe("failed")
    calls.length = 0
    const recovered = await generateReportCommentary({ ...state, reportCommentary: checkpoint }, defaultSettings(), async () => {})
    expect(recovered.status).toBe("ready")
    expect(calls).not.toContain("round-1")
    expect(calls).not.toContain("round-2")
    expect(calls).toContain("branch-1-0")
  } finally {
    spy.mockRestore()
  }
})

test("provider outage stops the frontier and cancellation starts no requests", async () => {
  const state = initialSimulationState("r", parseScenarioDocument("---\nnum_cast: 2\n---\nTest"))
  state.roundReports = Array.from({ length: 8 }, (_, i) => ({
    roundIndex: i + 1,
    title: "Meeting",
    roundSummary: "Discussed options"
  }))
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockRejectedValue(new Error("offline"))
  try {
    const result = await generateReportCommentary(state, defaultSettings(), async () => {})
    expect(result.status).toBe("failed")
    expect(spy).toHaveBeenCalledTimes(6)
    spy.mockClear()
    await expect(
      generateReportCommentary(
        state,
        defaultSettings(),
        async () => {},
        () => true
      )
    ).rejects.toThrow("Run canceled")
    expect(spy).toHaveBeenCalledTimes(0)
  } finally {
    spy.mockRestore()
  }
})
