import { expect, test } from "@playwright/test"

function reportFixture() {
  const actors = ["민수", "지수"].map((name, index) => ({ id: `a${index}`, name, role: "담당자", backgroundHistory: "출시 준비", personality: "신중함", preference: "안전한 출시", privateGoal: "", intent: "검토", actions: [], context: { visible: [] }, contextSummary: "", memory: [], relationships: {} }))
  const interactions = Array.from({ length: 8 }, (_, index) => ({ id: `i${index}`, roundIndex: index + 1, sourceActorId: "a0", targetActorIds: ["a1"], thought: `생각 ${index + 1}`, actionType: "근거 요청", content: `민수: 발화 ${index + 1}`, eventId: "event", visibility: "private", decisionType: "action", intent: `의도 ${index + 1}`, expectation: `기대 ${index + 1}` }))
  const run = { id: "report-fixture", status: "completed", createdAt: "2026-09-17T00:00:00Z", scenarioName: "리포트 검증", artifactPaths: {} }
  const state = { runId: run.id, scenario: { text: "출시 준비", sourceName: "리포트 검증", language: "ko", controls: { numCast: 2, actionsPerType: 1, maxRound: 8, fastMode: true, allowAdditionalCast: false } }, plan: { interpretation: "", backgroundStory: "", actionCatalog: {}, majorEvents: [{ id: "event", title: "출시 일정", summary: "일정 협의", status: "completed", participantIds: [] }] }, actors, interactions, roundDigests: [], roundReports: interactions.map(item => ({ roundIndex: item.roundIndex, title: `협의 ${item.roundIndex}`, roundSummary: `요약 ${item.roundIndex}` })), roleTraces: [], worldSummary: "", reportMarkdown: "", stopReason: "simulation_done", errors: [] as string[] }
  const timeline = [{ index: 0, timestamp: run.createdAt, nodes: actors.map(actor => ({ id: actor.id, label: actor.name, role: actor.role, intent: actor.intent, interactionCount: 8 })), edges: [{ id: "a0-a1", source: "a0", target: "a1", weight: 8, visibility: "private", roundIndex: 8, latestContent: "발화 8" }], messages: [], activeNodeIds: [], logRefs: [] }]
  const events = [{ type: "model.metrics", runId: run.id, timestamp: run.createdAt, metrics: { role: "actor", step: "message", attempt: 1, ttftMs: 200, durationMs: 1000, inputTokens: 100, outputTokens: 50, reasoningTokens: 0, totalTokens: 150, tokenSource: "provider" } }]
  return { run, state, timeline, events }
}

test("report round carousel selects messages independently from browsing and supports compact screens", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  const detail = reportFixture()
  const first = detail.state.interactions[0]!
  detail.state.interactions.push(...Array.from({ length: 100 }, (_, index) => ({ ...first, id: `long-${index}`, content: `민수: 긴 기록 ${index}`, thought: "긴 생각 ".repeat(10) })))
  await page.route("**/api/runs", route => route.fulfill({ json: { runs: [detail.run] } }))
  await page.route("**/api/runs/report-fixture", route => route.fulfill({ json: detail }))
  await page.goto("/")
  await page.getByRole("button", { name: /실행 내역 보기/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: /열기/ }).click()
  await expect(page.getByRole("tab", { name: "관계 분석", exact: true })).toHaveAttribute("data-state", "active")
  await page.getByPlaceholder("인물 찾기").fill("민수")
  await page.getByRole("button", { name: /민수/ }).click()
  await expect(page.getByRole("complementary", { name: "관계 상세" })).toContainText("신중함")
  await page.getByRole("combobox", { name: "연결선 선택" }).click()
  await page.getByRole("option", { name: "민수 → 지수" }).click()
  await expect(page.getByRole("complementary", { name: "관계 상세" })).toContainText("발화 8")
  await page.getByRole("tab", { name: "관계 히트맵", exact: true }).click()
  await expect(page.getByRole("heading", { name: "관계 히트맵", exact: true })).toBeVisible()
  await page.getByRole("tab", { name: "관계 그래프", exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath("01-relationships.png"), fullPage: true })
  await page.getByRole("tab", { name: "대화 기록", exact: true }).click()
  const previous = page.getByRole("button", { name: "이전 라운드 보기" })
  const next = page.getByRole("button", { name: "다음 라운드 보기" })
  await expect(page.getByText("발화 1", { exact: true })).toBeVisible()
  expect(await page.getByRole("article").count()).toBeLessThan(30)
  const historyViewport = page.locator('[data-history-items]').locator('..')
  expect(await historyViewport.evaluate(element => element.scrollTop)).toBe(0)
  await expect(previous).toBeDisabled()
  await expect(next).toBeEnabled()
  await next.click()
  await expect(page.getByText("발화 1", { exact: true })).toBeVisible()
  await expect(previous).toBeEnabled()
  await page.getByRole("button", { name: "라운드 5", exact: true }).click()
  await expect(page.getByText("발화 5", { exact: true })).toBeVisible()
  await expect(page.getByText("발화 1", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "메시지 상세", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("의도 5")
  await page.keyboard.press("Escape")
  await page.screenshot({ path: testInfo.outputPath("02-conversations.png"), fullPage: true })
  while (await next.isEnabled()) await next.click()
  await expect(next).toBeDisabled()
  await page.getByRole("tab", { name: "성능 분석", exact: true }).click()
  await expect(page.getByRole("table")).toContainText("1,000 ms")
  await page.getByRole("table").getByRole("button", { name: "인물", exact: true }).click()
  await expect(page.getByRole("region", { name: "호출 상세" })).toContainText("message metrics")
  await page.screenshot({ path: testInfo.outputPath("03-performance.png"), fullPage: true })
  await page.getByText("필터", { exact: true }).click()
  await page.getByLabel("최소", { exact: true }).fill("200")
  await expect(page.getByRole("table")).not.toContainText("1,000 ms")
  await page.getByLabel("최소", { exact: true }).fill("")
  await expect(page.getByRole("table")).toContainText("1,000 ms")
  await page.getByRole("tab", { name: "성능 분석", exact: true }).focus()
  await page.keyboard.press("ArrowLeft")
  await expect(page.getByRole("tab", { name: "대화 기록", exact: true })).toHaveAttribute("data-state", "active")
  await page.route("**/api/runs/report-fixture/export?kind=*", route => route.fulfill({ body: "test export", headers: { "content-type": "text/plain", "content-disposition": "attachment; filename=report.txt" } }))
  for (const label of ["JSON 내보내기", "JSONL 내보내기", "Markdown 내보내기"]) {
    await page.getByRole("button", { name: "내보내기", exact: true }).click()
    const download = page.waitForEvent("download")
    await page.getByRole("menuitem", { name: label, exact: true }).click()
    await download
  }
  await page.setViewportSize({ width: 390, height: 844 })
  expect(errors).toEqual([])
  for (const tab of ["관계 분석", "대화 기록", "성능 분석"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test("empty failed report remains readable", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  const detail = reportFixture()
  detail.state.interactions = []
  detail.state.roundReports = []
  detail.state.actors = []
  detail.state.errors = ["test failure"]
  const failed = { ...detail, run: { ...detail.run, status: "failed", error: "test failure" }, timeline: [], events: [] }
  await page.route("**/api/runs", route => route.fulfill({ json: { runs: [failed.run] } }))
  await page.route("**/api/runs/report-fixture", route => route.fulfill({ json: failed }))
  await page.goto("/")
  await page.getByRole("button", { name: /실행 내역 보기/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: /열기/ }).click()
  await expect(page.getByRole("alert")).toContainText("test failure")
  await page.getByRole("tab", { name: "대화 기록", exact: true }).click()
  await expect(page.getByRole("button", { name: "다음 라운드 보기" })).toHaveCount(0)
  await page.getByRole("tab", { name: "성능 분석", exact: true }).click()
  await expect(page.getByRole("region", { name: "모델 지표" })).toContainText("—")
})
