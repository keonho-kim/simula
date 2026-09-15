import { expect, test, type Route } from "@playwright/test"

test("scenario board fills ordered columns and opens structured details", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
  let start: Route | undefined
  await page.route("**/api/runs/*/start", route => { start = route })
  await page.goto("/")
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /시나리오 업로드/ }).click()
  await (await chooser).setFiles({ name: "preparation.md", mimeType: "text/markdown", buffer: Buffer.from("민수와 지수가 출시를 논의합니다.") })
  await page.getByLabel("등장 인원").fill("3")
  await page.getByLabel("최대 라운드").fill("1")
  await page.getByRole("button", { name: "시작하기", exact: true }).click()
  await expect.poll(() => Boolean(start)).toBe(true)
  // Hold the real run while displaying a long planning response deterministically.
  await page.evaluate(async () => {
    const path = "/src/ui/stores/run-store.ts"
    const { useRunStore } = await import(path)
    const store = useRunStore.getState()
    const base = { runId: store.selectedRunId, timestamp: new Date().toISOString() }
    store.pushEvents([
      { ...base, type: "run.started" },
      { ...base, type: "board.updated", update: { kind: "config", actorCount: 3, actionCount: 12 } },
      { ...base, type: "board.updated", update: { kind: "digest", key: "actorPressures", content: "인물들은 서로 다른 입장을 가지고 있습니다.\n\n".repeat(100) } },
      { ...base, type: "board.updated", update: { kind: "events", events: [{ id: "event-1", title: "입장권 오류", summary: "예약된 티켓이 한 사람의 이름으로 발급되었습니다.", status: "pending", participantIds: [] }] } },
      { ...base, type: "board.updated", update: { kind: "actions", actions: [{ id: "PRV01", label: "사과 방식 확인", visibility: "private", intentHint: "상대의 의도를 확인합니다.", expectedOutcome: "오해를 줄입니다." }] } },
    ])
  })
  const dialog = page.getByRole("dialog", { name: "시나리오 보드", exact: true })
  await expect(dialog).toBeVisible()
  const columns = dialog.locator('section[aria-label]')
  expect(await columns.evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")))).toEqual(["배경·갈등", "예상 이벤트", "행동", "인물 카드"])
  await expect(dialog).not.toContainText("PRV01")
  await expect(dialog.getByText("오해를 줄입니다.")).toHaveCount(0)
  await dialog.getByRole("button", { name: /사과 방식 확인/ }).click()
  await expect(dialog.getByRole("complementary")).toContainText("개인 대화")
  await expect(dialog.getByRole("complementary")).toContainText("오해를 줄입니다.")
  await dialog.getByRole("button", { name: /입장권 오류/ }).click()
  await expect(dialog.getByRole("complementary")).toContainText("예약된 티켓이 한 사람의 이름으로 발급되었습니다.")
  await dialog.getByRole("button", { name: /인물별 압력/ }).click()
  const overlay = page.locator('[data-slot="dialog-overlay"]')
  expect(await overlay.evaluate(element => {
    const box = element.getBoundingClientRect()
    return { width: box.width, height: box.height, blur: getComputedStyle(element).backdropFilter }
  })).toEqual({ width: 1440, height: 1000, blur: "none" })
  const box = (await dialog.boundingBox())!
  expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThan(1)
  expect(Math.abs(box.y + box.height / 2 - 500)).toBeLessThan(1)
  await page.keyboard.press("Escape")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("complementary")).toHaveCount(0)
  await dialog.getByRole("button", { name: /인물별 압력/ }).click()
  await page.screenshot({ path: testInfo.outputPath("preparation-desktop.png") })
  await page.setViewportSize({ width: 390, height: 600 })
  await expect.poll(async () => (await dialog.boundingBox())!.height).toBeLessThanOrEqual(568)
  const mobile = (await dialog.boundingBox())!
  expect(mobile.y).toBeGreaterThanOrEqual(0)
  expect(mobile.y + mobile.height).toBeLessThanOrEqual(600)
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  const content = dialog.getByRole('complementary').locator('.overflow-auto')
  expect(await content.evaluate(element => element.clientHeight > 0 && element.scrollHeight > element.clientHeight)).toBe(true)
  await content.evaluate(element => { element.scrollTop = element.scrollHeight })
  expect(await content.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath("preparation-mobile.png") })
  await page.evaluate(async () => {
    const path = "/src/ui/stores/run-store.ts"
    const { useRunStore } = await import(path)
    const store = useRunStore.getState()
    store.pushEvent({ type: "event.injected", runId: store.selectedRunId, timestamp: new Date().toISOString(),
      event: { id: "preview", sourceEventId: "event-1", roundIndex: 1, title: "입장권 오류", summary: "" } })
  })
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "시뮬레이션 보기", exact: true }).click()
  await expect(dialog).toBeHidden()
  await start!.continue()
  await expect(dialog).toBeHidden({ timeout: 20000 })
  await page.getByRole("button", { name: "계속 보기", exact: true }).click()
  await expect(page.getByRole("complementary").getByRole("article").first()).toBeVisible()
  const counts = await page.evaluate(async () => {
    const path = "/src/ui/stores/run-store.ts"
    const { useRunStore } = await import(path)
    const board = useRunStore.getState().scenarioBoard
    return { actions: board.actions.length, cards: Object.keys(board.cards).length, events: board.events.length }
  })
  expect(counts.actions).toBe(12)
  expect(counts.cards).toBe(3)
  expect(counts.events).toBeGreaterThan(0)
})
