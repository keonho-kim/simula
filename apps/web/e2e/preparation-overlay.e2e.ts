/**
 * Purpose: Verify the scenario board's preparation overlay and live detail.
 * Pattern: End-to-end workflow test.
 * Usage: Executed by Playwright through bun run test:e2e.
 * Related: src/ui/components/simulation/scenario-board.tsx, src/ui/shell/home-view.tsx
 */
import { expect, test, type Route } from "./fixtures"
import { motionRange } from "./motion-range"

test("scenario board fills ordered columns and opens structured details", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
  let start: Route | undefined
  await page.route("**/api/runs/*/start", route => { start = route })
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /완성된 시나리오 불러오기/ }).click()
  await (await chooser).setFiles({ name: "preparation.md", mimeType: "text/markdown", buffer: Buffer.from("민수와 지수가 출시를 논의합니다.") })
  await page.getByLabel("등장 인원").fill("3")
  await page.getByLabel("최대 라운드").fill("1")
  await page.getByRole("button", { name: "시작하기", exact: true }).click()
  await expect.poll(() => Boolean(start)).toBe(true)
  // Hold the real run while displaying a long planning response deterministically.
  await page.evaluate(async () => {
    const path = "/src/ui/stores/run-store.ts"
    const { useRunStore } = await window.__simulaE2E!.import(path)
    const store = useRunStore.getState()
    const base = { runId: store.selectedRunId, timestamp: new Date().toISOString() }
    store.pushEvents([
      { ...base, type: "run.started" },
      { ...base, type: "board.updated", update: { kind: "config", actorCount: 3, actionCount: 12 } },
      { ...base, type: "board.updated", update: { kind: "digest", key: "actorPressures", content: "인물들은 서로 다른 입장을 가지고 있습니다.\n\n".repeat(100) } },
      { ...base, type: "board.updated", update: { kind: "events", events: [{ id: "event-1", title: "입장권 오류", summary: "예약된 티켓이 한 사람의 이름으로 발급되었습니다.", status: "pending", participantIds: [] }, ...Array.from({ length: 60 }, (_, index) => ({ id: "extra-" + index, title: "추가 사건 " + index, summary: "설명", status: "pending", participantIds: [] }))] } },
      { ...base, type: "board.updated", update: { kind: "actions", actions: [{ id: "PRV01", label: "사과 방식 확인", visibility: "private", intentHint: "상대의 의도를 확인합니다.", expectedOutcome: "오해를 줄입니다." }] } },
    ])
  })
  const dialog = page.getByRole("dialog", { name: "시나리오 보드", exact: true })
  await expect(dialog).toBeVisible()
  const progress = dialog.getByRole("progressbar")
  await expect(progress).toContainText("13%")
  await expect(progress).not.toContainText(">")
  const dots = progress.locator(".scenario-progress-dot")
  await expect(dots).toHaveCount(10)
  expect(await motionRange(dots.first(), "top")).toBeGreaterThan(0.1)
  const columns = dialog.locator('section[aria-label]')
  expect(await columns.evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")))).toEqual(["배경·갈등", "예상 이벤트", "행동", "인물 카드"])
  await expect(columns.first()).toHaveAttribute("aria-busy", "true")
  const active = dialog.getByRole("button", { name: /배경 상황/ })
  await expect(active).toHaveAttribute("aria-busy", "true")
  let previewRequests = 0
  await page.route("**/board-preview?item=*", async route => {
    previewRequests++
    const id = new URL(route.request().url()).searchParams.get("item")!
    const fields = id === "actions-pending" ? { label: "답변 시점 협의", intentHint: "당장 답하기 어려울 때", expectedOutcome: "기다릴 시간을 합의한다" } : { coreSituation: "새로운 상황을 작성하고 있습니다." }
    const body = Object.entries(fields).map(([field, content]) => "event: board.updated\ndata: " + JSON.stringify({ type: "board.updated", runId: "test", timestamp: new Date().toISOString(), update: {
      kind: "preview", id, field, streamId: "test", sequence: 3, snapshot: true, content,
    } }) + "\n\n").join("")
    await route.fulfill({ contentType: "text/event-stream", body })
  })
  expect(previewRequests).toBe(0)
  await active.click()
  await expect(columns).toHaveCount(1)
  expect(await dialog.getByRole("complementary").evaluate(element => {
    const detail = element.getBoundingClientRect()
    const list = element.previousElementSibling!.getBoundingClientRect()
    return list.width / (list.width + detail.width)
  })).toBeCloseTo(0.4, 2)
  await expect(dialog.getByRole("complementary")).toContainText("새로운 상황을 작성하고 있습니다.")
  await expect(dialog.getByRole("complementary")).toContainText("검증 전")
  await dialog.getByRole("button", { name: "상세 닫기", exact: true }).click()
  expect(await motionRange(active.locator('span[aria-hidden="true"]').first(), "opacity")).toBeGreaterThan(0.01)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect.poll(() => motionRange(dots.first(), "top")).toBeLessThan(0.1)
  await expect.poll(() => motionRange(active.locator('span[aria-hidden="true"]').first(), "opacity")).toBeLessThan(0.01)
  await page.emulateMedia({ reducedMotion: "no-preference" })
  const eventList = dialog.getByRole("group", { name: "예상 이벤트", exact: true })
  expect(await eventList.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true)
  await eventList.evaluate(element => { element.scrollTop = element.scrollHeight })
  expect(await eventList.evaluate(element => element.scrollTop)).toBe(0)
  expect(await dialog.getByRole("group", { name: "배경·갈등", exact: true }).evaluate(element => element.scrollTop)).toBe(0)
  await expect(dialog).not.toContainText("PRV01")
  await expect(dialog.getByText("오해를 줄입니다.")).toHaveCount(0)
  await dialog.getByRole("button", { name: /사과 방식 확인/ }).click()
  await expect(dialog.getByRole("complementary")).toContainText("개인 대화")
  await expect(dialog.getByRole("complementary")).toContainText("오해를 줄입니다.")
  await page.evaluate(async () => {
    const path = "/src/ui/stores/run-store.ts"
    const { useRunStore } = await window.__simulaE2E!.import(path)
    const store = useRunStore.getState()
    store.pushEvents(["coreSituation", "conflictDynamics", "simulationDirection"].map(key => ({ type: "board.updated", runId: store.selectedRunId, timestamp: new Date().toISOString(), update: { kind: "digest", key, content: "완료된 기획 내용" } })))
  })
  await dialog.getByRole("button", { name: /진행 중 …/ }).click()
  const actionDraft = dialog.getByRole("complementary")
  await expect(actionDraft.getByRole("heading", { name: "행동 이름", exact: true })).toBeVisible()
  await expect(actionDraft).toContainText("답변 시점 협의")
  await expect(actionDraft).toContainText("사용 조건")
  await expect(actionDraft).toContainText("기다릴 시간을 합의한다")
  await expect(actionDraft).not.toContainText('"label":')

  await dialog.getByRole("button", { name: /전체 보드/ }).click()
  await dialog.getByRole("button", { name: /입장권 오류/ }).click()
  await expect(dialog.getByRole("complementary")).toContainText("예약된 티켓이 한 사람의 이름으로 발급되었습니다.")
  await dialog.getByRole("button", { name: /전체 보드/ }).click()
  await dialog.getByRole("button", { name: /인물별 이해관계/ }).click()
  const overlay = page.locator('[data-slot="dialog-overlay"]')
  expect(await overlay.evaluate(element => {
    const box = element.getBoundingClientRect()
    return { width: box.width, height: box.height, blur: getComputedStyle(element).backdropFilter }
  })).toEqual({ width: 1440, height: 1000, blur: "none" })
  const box = (await dialog.boundingBox())!
  expect(box).toMatchObject({ x: 0, y: 0, width: 1440, height: 1000 })
  await page.keyboard.press("Escape")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("complementary")).toHaveCount(0)
  await dialog.getByRole("button", { name: /인물별 이해관계/ }).click()
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("preparation-desktop.png") })
  await page.setViewportSize({ width: 390, height: 600 })
  await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(600)
  const mobile = (await dialog.boundingBox())!
  expect(mobile.y).toBe(0)
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  const content = dialog.getByRole("complementary")
  expect(await content.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true)
  expect(await dialog.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  await dialog.evaluate(element => { element.scrollTop = element.scrollHeight })
  expect(await dialog.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath("preparation-mobile.png") })
  await page.evaluate(async () => {
    const path = "/src/ui/stores/run-store.ts"
    const { useRunStore } = await window.__simulaE2E!.import(path)
    const store = useRunStore.getState()
    store.pushEvent({ type: "event.injected", runId: store.selectedRunId, timestamp: new Date().toISOString(),
      event: { id: "preview", sourceEventId: "event-1", roundIndex: 1, title: "입장권 오류", summary: "" } })
  })
  await expect(dialog).toBeVisible()
  expect(await progress.getAttribute("data-running")).toBe("false")
  await dialog.getByRole("button", { name: "시뮬레이션 보기", exact: true }).click()
  await expect(dialog).toBeHidden()
  await start!.continue()
  await expect(dialog).toBeHidden({ timeout: 20000 })
  await page.getByRole("button", { name: "계속 보기", exact: true }).click()
  await expect(page.getByRole("complementary").getByRole("article").first()).toBeVisible()
  const counts = await page.evaluate(async () => {
    const path = "/src/ui/stores/run-store.ts"
    const { useRunStore } = await window.__simulaE2E!.import(path)
    const board = useRunStore.getState().scenarioBoard
    return { actions: board.actions.length, cards: Object.keys(board.cards).length, events: board.events.length }
  })
  expect(counts.actions).toBe(12)
  expect(counts.cards).toBe(3)
  expect(counts.events).toBeGreaterThan(0)
  const runId = await page.evaluate(() => JSON.parse(sessionStorage.getItem("simula.run-session")!).runId)
  const detail = await (await page.request.get("/api/runs/" + runId)).json()
  expect(detail.events.some((event: { type: string; update?: { kind: string } }) => event.type === "board.updated" && event.update?.kind === "preview")).toBe(false)
})
