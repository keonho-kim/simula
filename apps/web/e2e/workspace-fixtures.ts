/**
 * Purpose: Seed realistic report and simulation screens without model calls.
 * Pattern: Browser test fixture.
 * Usage: Imported by workspace visual and live arrival tests.
 * Related: src/ui/shell/e2e-queries/runs.ts, apps/web/e2e/workspace-ui.e2e.ts
 */
import type { Page } from "./fixtures"
import type { BrowserRunDetail } from "@/ui/shell/e2e-queries/runs"
import type { AnalysisRecord } from "@/shared/analytical-report"
import { ANALYSIS_SECTIONS } from "@/shared/analytical-report"

export function workspaceRun(status: "running" | "completed" = "completed"): BrowserRunDetail {
  const id = "workspace-fixture"
  const actors = ["브랜드 책임자", "마케터", "매장 파트너", "소비자 대표"].map((name, i) => ({ id: `actor-${i + 1}`, name, role: name,
    backgroundHistory: "신제품 출시 검토", personality: "신중함", preference: "자료 검토", privateGoal: "", intent: "조건 확인",
    actions: [], context: { visible: [] }, contextSummary: "", memory: [], relationships: {} }))
  const run = { id, status, createdAt: "2026-09-30T03:00:00Z", scenarioName: "소비재 출시 검토: 광고 반응과 실제 구매의 간극", artifactPaths: { manifest: "", events: "", state: "", report: "", timeline: "" } }
  const interactions = actors.map((actor, index) => ({ id: `round-1-${actor.id}`, roundIndex: 1, sourceActorId: actor.id,
    targetActorIds: [actors[(index + 1) % actors.length].id], actionType: "근거 확인", content: `${actor.name}: ${index % 2 ? "실험 비용과 담당자를 먼저 정하고, 다음 확인일에 결과를 비교하겠습니다." : "광고 호감과 구매 전환은 다릅니다. 배송비 가설을 제한된 실험으로 확인합시다."}`,
    eventId: "review", visibility: "public" as const, decisionType: "action" as const, intent: "자료 검토", expectation: "실험 조건 합의" }))
  return { run, state: { runId: id, scenario: { text: "출시 검토", sourceName: run.scenarioName, language: "ko", controls: { numCast: 4, actionsPerType: 1, maxRound: 3, fastMode: true, allowAdditionalCast: false } },
    actors, interactions, roundDigests: [], roundReports: [], roleTraces: [], worldSummary: "", reportMarkdown: "", stopReason: status === "completed" ? "simulation_done" : "", errors: [] },
    events: [{ type: "actors.ready", runId: id, timestamp: run.createdAt, actors: actors.map(actor => ({ id: actor.id, label: actor.name, role: actor.role, intent: actor.intent, interactionCount: 1 })) },
      ...interactions.map(interaction => ({ type: "interaction.recorded" as const, runId: id, timestamp: run.createdAt, interaction }))],
    timeline: [{ index: 0, timestamp: run.createdAt, nodes: actors.map(actor => ({ id: actor.id, label: actor.name, role: actor.role, intent: actor.intent, interactionCount: 3 })),
      edges: interactions.map(interaction => ({ id: interaction.id, source: interaction.sourceActorId, target: interaction.targetActorIds[0], weight: 3, visibility: "public", roundIndex: 1, latestContent: interaction.content })), activeNodeIds: [], messages: [], logRefs: [] }] }
}
export function workspaceReport(runId: string): AnalysisRecord {
  return { id: "11111111-1111-4111-8111-111111111111", subject: { kind: "run", id: runId }, status: "ready", language: "ko", fastMode: false,
    inputRevision: "fixture", createdAt: "2026-09-30T03:00:00Z", deadlineAt: "2026-09-30T04:00:00Z", maxCalls: 100, report: {
      perspective: { focus: "출시 예산과 검증 계획", objective: "후속 실험 승인 조건", horizon: "다음 주", boundary: "가상 회의 · 4명", evidenceIds: [] },
      coverage: { requested: 1, completed: 1, analyzed: 1, failed: 0, canceled: 0, interrupted: 0 }, trajectories: { categories: [], unclassifiedWorldIds: [] }, evidenceIds: [], unavailableInputs: [],
      sections: ANALYSIS_SECTIONS.filter(id => id !== "trajectories").map(id => ({ id, status: "ready", summary: "출시 확대는 보류하고, 배송비 가설을 확인하는 제한 실험을 먼저 진행하는 방향으로 의견이 모였습니다.",
        content: "## 판단의 배경\n\n광고에 대한 호감과 실제 구매는 서로 다른 지표입니다. 작은 표본에서 관찰된 반응만으로 시장 전체의 수요를 판단하기는 어렵습니다.\n\n## 합의를 바꾼 조건\n\n매장 파트너가 운영 인력과 기록 방식의 한계를 설명하면서, 논의는 확대보다 검증 가능한 실험으로 옮겨갔습니다. 예산 범위와 담당자, 후속 확인일이 합의의 조건이 되었습니다.\n\n## 남은 불확실성\n\n배송비 지원이 추가 구매를 만드는지, 첫 구매가 재구매로 이어지는지는 확인되지 않았습니다.",
        findings: [{ text: "다음 실험은 예산·책임자·관찰 기간을 함께 정합니다.", evidenceIds: ["evidence-1"] }], evidenceIds: ["evidence-1"] })),
    } }
}
export async function seedWorkspace(page: Page, status: "running" | "completed" = "completed") {
  const detail = workspaceRun(status)
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  await page.route(`**/api/runs/${detail.run.id}`, route => route.fulfill({ json: detail }))
  await page.route("**/api/analysis?*", route => route.fulfill({ json: { analysis: workspaceReport(detail.run.id), freshness: "current" } }))
  await page.route("**/api/analysis/*/reference?*", route => route.fulfill({ json: { reference: { id: "evidence-1", category: "source_claim", text: "인터뷰 대상 8명 중 4명이 배송비를 구매 장애로 언급했습니다.", } } }))
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.evaluate(async detail => {
    const { saveRunDetail } = await window.__simulaE2E!.import("/src/ui/shell/e2e-queries/runs.ts") as typeof import("@/ui/shell/e2e-queries/runs")
    await saveRunDetail(detail)
  }, detail)
  await page.reload()
  return detail
}
