/**
 * Purpose: Verify Report metrics, analysis board, analysis layouts, and compact-screen behavior.
 * Pattern: Browser Workflow Test.
 * Usage: Run through `bun run test:e2e`.
 * Related: src/ui/pages/report-page.tsx, src/ui/styles/report.css
 */
import { expect, test, type Page } from "./fixtures"
import { ANALYSIS_SECTIONS } from "@/shared/analytical-report"
import type { RunManifest } from "@/shared"
import type { BrowserRunDetail } from "@/ui/shell/e2e-queries/runs"

async function seedRun(page: Page, detail: BrowserRunDetail, accepted = true): Promise<void> {
  await page.route("**/api/analysis?*", route => route.fulfill({ json: {
    analysis: { id: "55555555-5555-4555-8555-555555555555", subject: { kind: "run", id: detail.run.id },
      inputRevision: "fixture", language: "ko", fastMode: false, createdAt: detail.run.createdAt,
      deadlineAt: detail.run.createdAt, maxCalls: 1, status: accepted ? "ready" : "failed",
      report: accepted ? { perspective: { focus: "검토", objective: "판단", horizon: "현재", boundary: "일정", evidenceIds: [] },
        coverage: { requested: 1, completed: 1, analyzed: 1, failed: 0, canceled: 0, interrupted: 0 },
        trajectories: { categories: [], unclassifiedWorldIds: [] }, sections: ANALYSIS_SECTIONS.filter(id => id !== "trajectories").map(id => ({ id, status: "ready", summary: "요약", content: "상세 결론입니다.", findings: [], evidenceIds: [] })), evidenceIds: [], unavailableInputs: [] } : undefined }, freshness: "current",
  } }))
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.evaluate(async saved => {
    const moduleUrl = "/src/ui/shell/e2e-queries/runs.ts"
    const { saveRunDetail } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/shell/e2e-queries/runs")
    await saveRunDetail(saved)
  }, detail)
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
}

function reportFixture() {
  const actors = ["민수", "지수"].map((name, index) => ({ id: `a${index}`, name, role: "담당자", backgroundHistory: "출시 준비", personality: "신중함", preference: "안전한 출시", privateGoal: "", intent: "검토", actions: [], context: { visible: [] }, contextSummary: "", memory: [], relationships: {} }))
  const interactions = Array.from({ length: 8 }, (_, index) => ({ id: `i${index}`, roundIndex: index + 1, sourceActorId: "a0", targetActorIds: ["a1"], thought: `생각 ${index + 1}`, actionType: "근거 요청", content: `민수: 발화 ${index + 1}`, eventId: "event", visibility: "private", decisionType: "action", intent: `의도 ${index + 1}`, expectation: `기대 ${index + 1}` }))
  const run: RunManifest = { id: "report-fixture", status: "completed", createdAt: "2026-09-17T00:00:00Z", scenarioName: "리포트 검증",
    artifactPaths: { manifest: "", events: "", state: "", report: "", timeline: "" } }
  const state = { runId: run.id, scenario: { text: "출시 준비", sourceName: "리포트 검증", language: "ko", controls: { numCast: 2, actionsPerType: 1, maxRound: 8, fastMode: true, allowAdditionalCast: false } }, plan: { interpretation: "", backgroundStory: "", actionCatalog: {}, majorEvents: [{ id: "event", title: "출시 일정", summary: "일정 협의", status: "completed", participantIds: [] }] }, actors, interactions, roundDigests: [], roundReports: interactions.map(item => ({ roundIndex: item.roundIndex, title: `협의 ${item.roundIndex}`, roundSummary: `요약 ${item.roundIndex}` })), roleTraces: [], worldSummary: "", reportMarkdown: "", stopReason: "simulation_done", errors: [] as string[] }
  const timeline = [{ index: 0, timestamp: run.createdAt, nodes: actors.map(actor => ({ id: actor.id, label: actor.name, role: actor.role, intent: actor.intent, interactionCount: 8 })), edges: [{ id: "a0-a1", source: "a0", target: "a1", weight: 8, visibility: "private", roundIndex: 8, latestContent: "발화 8" }], messages: [], activeNodeIds: [], logRefs: [] }]
  const events = [{ type: "model.metrics", runId: run.id, timestamp: run.createdAt, metrics: { role: "actor", step: "message", attempt: 1, ttftMs: 200, durationMs: 1000, inputTokens: 100, outputTokens: 50, reasoningTokens: 0, totalTokens: 150, tokenSource: "provider" } }]
  return { run, state, timeline, events }
}

test("report round carousel selects messages independently from browsing and supports compact screens", async ({ page, browserName }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  const detail = reportFixture()
  const first = detail.state.interactions[0]!
  detail.state.interactions.push(...Array.from({ length: 100 }, (_, index) => ({ ...first, id: `long-${index}`, content: `민수: 긴 기록 ${index}`, thought: "긴 생각 ".repeat(10) })))
  await seedRun(page, detail as unknown as BrowserRunDetail)
  await page.getByRole("button", { name: /실행 내역 보기/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: /열기/ }).click()
  const metrics = page.getByRole("region", { name: "모델 지표" })
  await expect(metrics).toBeVisible()
  await expect(metrics.getByRole("article")).toHaveCount(4)
  await expect(metrics).toContainText("200 ms")
  await expect(metrics).toContainText("150")
  await expect(metrics).toContainText("1 샘플")
  await expect(page.getByRole("tab", { name: "종합 결론", exact: true })).toBeVisible()
  await expect(page.getByRole("region", { name: "분석 리포트", exact: true })).toBeVisible()
  await page.getByRole("tab", { name: "관계 분석", exact: true }).click()
  await expect(page.getByPlaceholder("인물 찾기")).toHaveCount(0)
  await expect(page.getByRole("combobox", { name: "연결선 선택" })).toHaveCount(0)
  await expect(page.getByRole("tab", { name: "관계 히트맵", exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "관계 히트맵", exact: true })).toBeVisible()
  const heatmap = await page.getByRole("heading", { name: "관계 히트맵", exact: true }).boundingBox()
  const graph = await page.getByRole("region", { name: "관계 그래프" }).boundingBox()
  expect(heatmap!.y).toBeLessThan(graph!.y)
  expect(await page.locator("details").count()).toBe(0)
  await page.screenshot({ path: testInfo.outputPath("01-relationships.png"), fullPage: true })
  await page.getByRole("tab", { name: "종합 결론", exact: true }).click()
  await expect(metrics).toBeVisible()
  await page.getByRole("tab", { name: "대화 기록", exact: true }).click()
  const conversationPanel = page.getByRole("tabpanel", { name: "대화 기록" })
  await expect(conversationPanel.locator('[data-slot="scroll-area-viewport"]')).toHaveCount(0)
  expect(await conversationPanel.evaluate(element => getComputedStyle(element).overflowY)).toBe("visible")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  const previous = page.getByRole("button", { name: "이전 라운드 보기" })
  const next = page.getByRole("button", { name: "다음 라운드 보기" })
  await expect(page.getByText("발화 1", { exact: true })).toBeVisible()
  expect(await page.getByRole("article").count()).toBeLessThan(30)
  const historyViewport = page.locator('[data-history-items]').locator('..')
  expect(await historyViewport.evaluate(element => element.scrollTop)).toBe(0)
  await expect(previous).toBeDisabled()
  await expect(next).toBeEnabled()
  await next.scrollIntoViewIfNeeded()
  const scrollBeforeBrowsing = await page.evaluate(() => window.scrollY)
  await next.click()
  await expect(page.getByText("발화 1", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeBrowsing)
  await expect(previous).toBeEnabled()
  await next.click()
  await next.click()
  await next.click()
  await page.getByRole("button", { name: "라운드 5", exact: true }).click()
  await expect(page.getByText("발화 5", { exact: true })).toBeVisible()
  await expect(page.getByText("발화 1", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "메시지 상세", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "메시지 상세" })).toContainText("의도 5")
  await page.keyboard.press("Escape")
  await page.screenshot({ path: testInfo.outputPath("02-conversations.png"), fullPage: true })
  await page.getByRole("tab", { name: "종합 결론", exact: true }).click()
  await page.route("**/api/runs/report-fixture/export?kind=*", route => route.fulfill({ body: "test export", headers: { "content-type": "text/plain", "content-disposition": "attachment; filename=report.txt" } }))
  for (const label of ["JSON 내보내기", "JSONL 내보내기", "Markdown 내보내기"]) {
    await page.getByRole("button", { name: "내보내기", exact: true }).click()
    const download = page.waitForEvent("download")
    await page.getByRole("menuitem", { name: label, exact: true }).click()
    await download
  }
  await page.setViewportSize({ width: 390, height: 844 })
  const unexpectedErrors = errors.filter(error => !(browserName === "webkit" &&
    error.includes("/api/runs/report-fixture due to access control checks.")))
  expect(unexpectedErrors).toEqual([])
  for (const label of ["관계 분석", "대화 기록"]) {
    await page.getByRole("tab", { name: label, exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const panel = await page.getByRole("tabpanel", { name: label }).boundingBox()
    expect(panel!.width).toBeLessThanOrEqual(390)
    await page.getByRole("tab", { name: "종합 결론", exact: true }).click()
  }

})

test("empty failed report remains in preparation with metrics and recovery", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  const detail = reportFixture()
  detail.state.interactions = []
  detail.state.roundReports = []
  detail.state.actors = []
  detail.state.errors = ["test failure"]
  const failed = { ...detail, run: { ...detail.run, status: "failed" as const, error: "test failure" }, timeline: [], events: [] }
  await seedRun(page, failed as unknown as BrowserRunDetail, false)
  await page.getByRole("button", { name: /실행 내역 보기/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: /열기/ }).click()
  await expect(page.getByRole("alert").filter({ hasText: "test failure" })).toContainText("test failure")
  await expect(page).toHaveURL(`/reports/${detail.run.id}/prepare`)
  await expect(page.getByRole("button", { name: "미완료 분석 재시도", exact: true })).toBeVisible()
  await expect(page.locator(".report-preparation-column")).toHaveCount(3)
  const metrics = page.getByRole("region", { name: "모델 지표" })
  await expect(metrics.getByRole("article")).toHaveCount(4)
  await expect(metrics).toContainText("—")
  await expect(metrics).toContainText("0 샘플")
})
