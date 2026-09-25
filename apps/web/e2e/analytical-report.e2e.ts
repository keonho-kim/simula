/**
 * Purpose: Verify analytical reading, source inspection, live replacement, and bounded responsive report UI.
 * Pattern: Browser contract tests with explicit report/stream fixtures.
 * Usage: bun run test:e2e apps/web/e2e/analytical-report.e2e.ts
 * Related: src/ui/components/report/analysis, src/backend/api/analysis/analysis-controller.test.ts
 */
import { expect, test, type Page } from "./fixtures"
import { readFile } from "node:fs/promises"
import type { AnalysisRecord, ResourceAccounting } from "../../../src/shared/analytical-report"
import type { RunManifest } from "../../../src/shared/run"
import { ANALYSIS_SECTIONS } from "../../../src/shared/analytical-report"

const reportId = "33333333-3333-4333-8333-333333333333"
const timestamp = "2026-09-23T12:00:00.000Z"
const run: RunManifest = { id: "analysis-browser", status: "completed", createdAt: timestamp, scenarioName: "투자 검토",
  artifactPaths: { manifest: "", events: "", state: "", report: "", timeline: "" } }
const emptyUsage = { calls: 0, observedCalls: 0, durationMs: 0, queueWaitMs: 0,
  inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, unavailableTokenCalls: 0 }
const accountingFixture: ResourceAccounting = { sharedPreparation: null,
  worlds: [{ worldId: run.id, runId: run.id, source: "run", usage: emptyUsage }], worldsUnavailable: false,
  worldTotal: emptyUsage, analysisGeneration: emptyUsage, overall: emptyUsage }
function analysisFixture(): AnalysisRecord {
  return { id: reportId, subject: { kind: "run", id: run.id }, inputRevision: "version-one", language: "ko", fastMode: true,
    createdAt: timestamp, deadlineAt: timestamp, maxCalls: 100, status: "ready", report: {
      perspective: { focus: "투자위원회", objective: "근거를 확인한 투자 판단", horizon: "분기", boundary: "내부 예산과 외부 비용", evidenceIds: ["source"] },
      coverage: { requested: 5, completed: 3, analyzed: 3, failed: 1, canceled: 1, interrupted: 0 },
      trajectories: { categories: [{ id: "path-one", label: "추가 검토 후 보류", description: "근거를 요청하고 결정을 보류했습니다.", worldIds: ["one", "two"] }], unclassifiedWorldIds: ["three"] },
      sections: ANALYSIS_SECTIONS.map(id => ({ id, status: "ready", summary: "비용 근거를 검토한 뒤 결정이 보류되었습니다.", content: "## 판단 근거\n\n추가 자료가 필요합니다.\n\n자료의 주장과 관찰 결과를 구분합니다.", findings: [{ text: "근거 확인이 의사결정에 선행했습니다.", evidenceIds: ["source"], provenance: ["source_claim"] }], evidenceIds: ["source"],
        ...(["strengths", "weaknesses", "opportunities", "threats"].includes(id) ? { score: { value: id === "threats" ? null : 2, rationale: "관찰된 영향도입니다.", evidenceIds: ["source"] } } : {}) })),
      evidenceIds: ["source"], unavailableInputs: [],
    } }
}
async function openRun(page: Page, selectedRun = run) {
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  await page.route(`**/api/runs/${selectedRun.id}`, route => route.fulfill({ json: { run: selectedRun, timeline: [], events: [] } }))
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.evaluate(async manifest => {
    const moduleUrl = "/src/ui/shell/e2e-queries/runs.ts"
    const { saveRunManifest } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/shell/e2e-queries/runs")
    await saveRunManifest(manifest)
  }, selectedRun)
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /실행 내역 보기/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: /열기/ }).click()
}

test("saved analysis opens without generation and exposes evidence, unknown scores, and accessible detail", async ({ page }, testInfo) => {
  const record = analysisFixture()
  let modelRequests = 0
  await page.route(url => url.pathname.startsWith("/api/analysis"), route => {
    const url = new URL(route.request().url())
    if (route.request().method() === "POST") modelRequests++
    if (url.pathname.endsWith("/metrics")) return route.fulfill({ json: { calls: [] } })
    if (url.pathname.endsWith("/accounting")) return route.fulfill({ json: { accounting: accountingFixture } })
    if (url.pathname.endsWith("/export")) return route.fulfill({ json: {
      formatVersion: 2, reportId: record.id, subject: record.subject, inputRevision: record.inputRevision,
      acceptedDigest: "a".repeat(64), createdAt: record.createdAt, language: record.language,
      executionStatus: record.status, freshness: "current", metricsScope: "analysis_generation", report: record.report,
      references: [{ id: "source", category: "source_claim", text: "승인 예산은 1억 2천만 원입니다.", locator: { kind: "page", page: 2, element: "budget" } }], metrics: [],
      accounting: accountingFixture,
    } })
    if (url.pathname.endsWith("/reference")) return route.fulfill({ json: { reference: { id: "source", category: "source_claim", text: "승인 예산은 1억 2천만 원입니다.", locator: { kind: "page", page: 2, element: "budget" } } } })
    return route.fulfill({ json: { analysis: record, freshness: "current" } })
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await openRun(page)
  await expect(page.getByRole("tab")).toHaveCount(0)
  await expect(page.getByRole("region", { name: "범위별 자원 사용량" })).toContainText("공통 자료·시나리오 준비")
  await expect(page.getByRole("region", { name: "범위별 자원 사용량" })).toContainText("세계별 합계")
  await expect(page.getByRole("heading", { name: "종합 결론", exact: true })).toBeVisible()
  await expect(page.getByText("이 리포트의 사건과 전개는 시뮬레이션에서 관찰한 결과이며, 실제 발생 사실이나 확률을 뜻하지 않습니다.")).toBeVisible()
  await expect(page.locator(".report-radar svg")).toHaveCount(0)
  await expect(page.getByText("판단 근거 부족", { exact: true }).first()).toBeVisible()
  for (const [label, extension] of [["분석 JSON", "json"], ["분석 Markdown", "md"]] as const) {
    await page.getByRole("button", { name: "내보내기", exact: true }).click()
    const downloaded = page.waitForEvent("download")
    await page.getByRole("menuitem", { name: label, exact: true }).click()
    const file = await downloaded
    expect(file.suggestedFilename()).toBe(`${record.id}.analysis.${extension}`)
    const body = await readFile(await file.path(), "utf8")
    expect(body).toContain("승인 예산은 1억 2천만 원입니다.")
    if (extension === "json") expect(JSON.parse(body).report.coverage.requested).toBe(5)
    else expect(body).toContain("# 분석 보드")
  }
  await page.screenshot({ path: testInfo.outputPath("analysis-board.png"), fullPage: true })
  const trigger = page.getByRole("button", { name: "강점", exact: true })
  await trigger.click()
  const dialog = page.getByRole("dialog", { name: "강점", exact: true })
  await expect(dialog.getByRole("heading", { name: "판단 근거" })).toBeVisible()
  await expect(dialog.getByRole("listitem").filter({ hasText: "근거 확인이 의사결정에 선행했습니다." })).toContainText("자료의 주장")
  await dialog.getByRole("button", { name: "근거 1", exact: true }).click()
  await expect(dialog).toContainText("승인 예산은 1억 2천만 원입니다.")
  await expect(dialog).toContainText("2페이지")
  const box = await dialog.boundingBox()
  expect(box!.width).toBeGreaterThan(1200)
  expect(box!.height).toBeGreaterThan(800)
  await page.screenshot({ path: testInfo.outputPath("analysis-detail.png"), fullPage: true })
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()
  await page.setViewportSize({ width: 390, height: 844 })
  await trigger.click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await dialog.boundingBox())!.width).toBe(390)
  await page.screenshot({ path: testInfo.outputPath("analysis-mobile.png"), fullPage: true })
  expect(modelRequests).toBe(0)
})

test("batch accounting shows fifty per-world rows in the full page scroll on mobile", async ({ page }) => {
  const batchId = "77777777-7777-4777-8777-777777777777"
  const selectedRun = { ...run, batchId }
  const record = analysisFixture()
  record.subject = { kind: "batch", id: batchId }
  const known = { ...emptyUsage, calls: 1, observedCalls: 1, durationMs: 20, inputTokens: 10,
    outputTokens: 5, totalTokens: 15 }
  const unknown = { ...emptyUsage, calls: null, observedCalls: 1, durationMs: null,
    inputTokens: null, reasoningTokens: null, outputTokens: null, totalTokens: null, unavailableTokenCalls: 1 }
  const accounting: ResourceAccounting = { sharedPreparation: known,
    worlds: Array.from({ length: 50 }, (_, index) => ({ worldId: `world-${index + 1}`, source: index === 49 ? "preparation" as const : "run" as const,
      usage: index === 49 ? unknown : known })),
    worldsUnavailable: false, worldTotal: { ...unknown, observedCalls: 50 },
    analysisGeneration: emptyUsage, overall: { ...unknown, observedCalls: 51 } }
  await page.route(url => url.pathname.startsWith("/api/analysis"), route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/metrics")) return route.fulfill({ json: { calls: [] } })
    if (url.pathname.endsWith("/accounting")) return route.fulfill({ json: { accounting } })
    return route.fulfill({ json: url.searchParams.get("kind") === "batch" ? { analysis: record, freshness: "current" }
      : { analysis: null, freshness: null } })
  })
  await openRun(page, selectedRun)
  await page.getByRole("button", { name: "이 멀티버스 종합 분석" }).click()
  const panel = page.getByRole("region", { name: "범위별 자원 사용량" })
  await expect(panel).toContainText("공통 자료·시나리오 준비")
  await expect(panel).toContainText("세계 1")
  await expect(panel).toContainText("세계 50")
  await expect(panel).toContainText("확인된 호출 1회")
  await expect(panel.locator("li")).toHaveCount(50)
  await expect(panel).toContainText("전체 토큰 —")
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await panel.locator('[aria-label="세계별 합계"]').evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("visible live sections replace retried drafts without duplicates and cancel independently of viewing", async ({ page }, testInfo) => {
  const record = analysisFixture(); record.report = undefined; record.status = "running"
  const executionId = "44444444-4444-4444-8444-444444444444"
  await page.route(url => url.pathname.startsWith("/api/analysis"), route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/metrics")) return route.fulfill({ json: { calls: [] } })
    if (url.pathname.endsWith("/cancel")) { record.status = "canceled"; return route.fulfill({ json: { status: "canceling" } }) }
    if (url.pathname.endsWith("/events")) {
      const tasks = ["conclusion-source", "conclusion-observations", "conclusion-implications"].map(taskId => ({ type: "task", taskId, kind: "conclusion", attempt: 1, status: "running" }))
      const selected = url.searchParams.get("task")
      const events: Array<{ type: string; [key: string]: unknown }> = [{ type: "snapshot", executionId, tasks }]
      if (selected) {
        events.push({ type: "event", executionId, event: { type: "draft", taskId: selected, attempt: 1, sequence: 1, fields: [{ key: "content", text: "폐기된 초안" }] } })
        events.push({ type: "event", executionId, event: { type: "task", taskId: selected, kind: "conclusion", attempt: 2, status: "running" } })
        const draft = { type: "event", executionId, event: { type: "draft", taskId: selected, attempt: 2, sequence: 1, fields: [{ key: "content", text: "수정된 분석을 실시간으로 작성합니다." }] } }
        events.push(draft, draft)
      }
      return route.fulfill({ contentType: "text/event-stream", body: events.map(event => `event: ${event.type}
data: ${JSON.stringify(event)}

`).join("") })
    }
    return route.fulfill({ json: { analysis: record, freshness: "current" } })
  })
  await openRun(page)
  await expect(page.locator(".report-live-task")).toHaveCount(3)
  await expect(page.locator(".report-live-task").filter({ hasText: "시뮬레이션 관찰" })).toHaveCount(1)
  await expect(page.locator(".report-live-task").filter({ hasText: "시사점·확인 과제" })).toHaveCount(1)
  await expect(page.getByText("수정된 분석을 실시간으로 작성합니다.", { exact: true })).toHaveCount(3)
  await expect(page.getByText("폐기된 초안", { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("analysis-live.png"), fullPage: true })
  await page.getByRole("button", { name: "생성 중지", exact: true }).click()
  await expect(page.getByRole("button", { name: "미완료 분석 재시도", exact: true })).toBeEnabled()
  await expect(page.locator(".report-live-task")).toHaveCount(0)
})

test("a fully assessed radar appears once and honors reduced motion", async ({ page }, testInfo) => {
  const record = analysisFixture()
  const threat = record.report?.sections.find(section => section.id === "threats")
  if (!threat?.score) throw new Error("Missing test score")
  threat.score.value = 3
  await page.route(url => url.pathname.startsWith("/api/analysis"), route => {
    const pathname = new URL(route.request().url()).pathname
    return route.fulfill({ json: pathname.endsWith("/metrics") ? { calls: [] }
      : pathname.endsWith("/accounting") ? { accounting: accountingFixture } : { analysis: record, freshness: "current" } })
  })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await openRun(page)
  const chart = page.locator(".report-chart-entry")
  await expect(chart.locator("svg")).toBeVisible()
  expect(await chart.evaluate(element => getComputedStyle(element).animationName)).toBe("none")
  await page.screenshot({ path: testInfo.outputPath("analysis-radar.png"), fullPage: true })
  await page.getByRole("button", { name: "강점", exact: true }).click()
  await page.getByRole("button", { name: "상세 닫기" }).click()
  await expect(chart).toHaveCount(1)
})
