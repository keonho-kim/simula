/**
 * Purpose: Verify Markdown export keeps partial analysis, source positions, and unknown usage readable.
 * Pattern: Pure report projection test.
 * Usage: bun test src/ui/models/report/analytical-export.test.ts
 * Related: src/ui/models/report/analytical-export.ts, src/shared/analytical-report.ts
 */
import { expect, test } from "bun:test"
import type { AnalyticalExport } from "@/shared/analytical-report"
import { dictionary } from "@/ui/i18n/dictionary"
import { renderAnalyticalMarkdown } from "./analytical-export"

const artifact: AnalyticalExport = {
  formatVersion: 2, reportId: "33333333-3333-4333-8333-333333333333", subject: { kind: "run", id: "run-one" },
  inputRevision: "revision-a", acceptedDigest: "a".repeat(64), createdAt: "2026-09-23T12:00:00Z",
  language: "ko", executionStatus: "partial", freshness: "outdated", metricsScope: "analysis_generation",
  report: { perspective: { focus: "투자 <script>alert(1)</script>", objective: "투자 검토", horizon: "이번 분기", boundary: "예산", evidenceIds: ["source"] },
    coverage: { requested: 5, completed: 3, analyzed: 3, failed: 1, canceled: 1, interrupted: 0 },
    trajectories: { categories: [{ id: "path-one", label: "추가 검토", description: "결정 보류", worldIds: ["one", "two"] }], unclassifiedWorldIds: ["three"] },
    sections: [
      { id: "strengths", status: "ready", summary: "근거 요청", content: "[위험 링크](javascript:alert(1))\n<script>alert(1)</script>", findings: [{ text: "비용 확인", evidenceIds: ["source"], provenance: ["source_claim"] }], evidenceIds: ["source"], score: { value: null, rationale: "수치 근거 부족", evidenceIds: [] } },
      { id: "weaknesses", status: "failed", summary: "", content: "", findings: [], evidenceIds: [] },
      { id: "conclusion", status: "ready", summary: "추가 검토", content: "조건부 판단", findings: [], evidenceIds: ["source"] },
    ], evidenceIds: ["source"], unavailableInputs: ["unreadable-document"] },
  references: [{ id: "source", category: "source_claim", text: "예산 120백만 원", documentId: "11111111-1111-4111-8111-111111111111", locator: { kind: "page", page: 2, element: "budget" } }],
  metrics: [{ timestamp: "2026-09-23T12:00:00Z", metrics: { role: "observer", step: "reportCommentary", attempt: 1, ttftMs: 20, durationMs: 100,
    inputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0, tokenSource: "unavailable" } }],
  accounting: { sharedPreparation: null, worldsUnavailable: false, worlds: [{ worldId: "run-one", runId: "run-one", source: "run",
    usage: { calls: 2, observedCalls: 2, durationMs: 200, queueWaitMs: null, inputTokens: null, reasoningTokens: null,
      outputTokens: null, totalTokens: null, unavailableTokenCalls: 1 } }],
    worldTotal: { calls: 2, observedCalls: 2, durationMs: 200, queueWaitMs: null, inputTokens: null, reasoningTokens: null,
      outputTokens: null, totalTokens: null, unavailableTokenCalls: 1 },
    analysisGeneration: { calls: 1, observedCalls: 1, durationMs: 100, queueWaitMs: null,
      inputTokens: null, reasoningTokens: null, outputTokens: null, totalTokens: null, unavailableTokenCalls: 1 },
    overall: { calls: 3, observedCalls: 3, durationMs: 300, queueWaitMs: null,
      inputTokens: null, reasoningTokens: null, outputTokens: null, totalTokens: null, unavailableTokenCalls: 2 } },
}

test("partial Markdown export preserves scope, source location, and unavailable usage without rendering source instructions", () => {
  const markdown = renderAnalyticalMarkdown(artifact, dictionary.ko)
  expect(markdown).toContain("# 분석 보드")
  expect(markdown.indexOf("## 종합 결론")).toBeLessThan(markdown.indexOf("## 강점"))
  expect(markdown).toContain("전체 5개 세계 중 완료 3개 · 분석 3개")
  expect(markdown).toContain("## 일부 분석 또는 원본 자료가 부족합니다")
  expect(markdown).toContain("2페이지")
  expect(markdown).toContain("판단 근거 부족")
  expect(markdown).toContain("전체 토큰 —")
  expect(markdown).toContain("## 범위별 자원 사용량")
  expect(markdown).toContain("세계 run-one: 호출 2")
  expect(markdown).not.toContain("<script>")
  expect(markdown).not.toContain("[위험 링크](javascript:alert(1))")
  expect(markdown).toContain("예산 120백만 원")
  expect(markdown).toContain("자료의 주장 — 비용 확인")
})
