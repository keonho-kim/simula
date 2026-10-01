/**
 * Purpose: Verify the scenario board page, live detail, and simulation handoff.
 * Pattern: End-to-end workflow test.
 * Usage: Executed by Playwright through bun run test:e2e.
 * Related: src/ui/pages/scenario-board-page.tsx, src/ui/shell/browser-route.ts
 */
import { expect, test, type Route } from "./fixtures"

test("scenario board opens as a page and hands off when preparation ends", async ({ page }) => {
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
  await expect(page).toHaveURL(/\/scenario-board$/)
  const board = page.getByRole("main")
  await expect(board.getByRole("heading", { name: "시나리오 보드", exact: true })).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.evaluate(async () => {
    const { useRunStore } = await window.__simulaE2E!.import("/src/ui/stores/run-store.ts")
    const store = useRunStore.getState()
    const base = { runId: store.selectedRunId, timestamp: new Date().toISOString() }
    store.pushEvents([
      { ...base, type: "run.started" },
      { ...base, type: "board.updated", update: { kind: "config", actorCount: 3, actionCount: 12 } },
      { ...base, type: "board.updated", update: { kind: "digest", key: "coreSituation", content: "출시를 앞둔 상황입니다." } },
      { ...base, type: "board.updated", update: { kind: "events", events: [
        { id: "event-1", title: "입장권 오류", summary: "예약된 티켓이 한 사람의 이름으로 발급되었습니다.", status: "pending", participantIds: [] },
      ] } },
    ])
  })
  const columns = board.locator('section[aria-label]')
  await expect(columns).toHaveCount(4)
  const title = board.getByRole("heading", { name: "시나리오 보드", exact: true })
  await expect.poll(() => title.evaluate(element => {
    const surface = element.closest(".relative.min-h-svh.w-full.bg-background")
    return surface ? getComputedStyle(surface).transform : "none"
  })).toBe("none")
  const titleX = (await title.boundingBox())!.x
  expect(await columns.evaluateAll(elements => elements.map(element => element.getAttribute("aria-label"))))
    .toEqual(["배경·갈등", "예상 이벤트", "행동", "인물 카드"])
  await board.getByRole("button", { name: /입장권 오류/ }).click()
  await expect(columns).toHaveCount(1)
  await expect(board.getByRole("complementary")).toContainText("예약된 티켓이 한 사람의 이름으로 발급되었습니다.")
  const back = board.getByRole("button", { name: "전체 보드" })
  await expect(back).toBeVisible()
  await expect(back).toHaveText("")
  expect((await title.boundingBox())!.x).toBe(titleX)
  expect(await back.evaluate(element => element.closest("header")?.querySelector("h1")?.textContent)).toBe("시나리오 보드")
  expect(await board.getByRole("complementary").evaluate(element => {
    const detail = element.getBoundingClientRect()
    const list = element.previousElementSibling!.getBoundingClientRect()
    return list.width / (list.width + detail.width)
  })).toBeCloseTo(0.4, 2)
  await back.click()
  await expect(columns).toHaveCount(4)
  await page.setViewportSize({ width: 390, height: 600 })
  expect(await board.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.evaluate(async () => {
    const { useRunStore } = await window.__simulaE2E!.import("/src/ui/stores/run-store.ts")
    const store = useRunStore.getState()
    store.pushEvent({ type: "event.injected", runId: store.selectedRunId, timestamp: new Date().toISOString(),
      event: { id: "preview", sourceEventId: "event-1", roundIndex: 1, title: "입장권 오류", summary: "" } })
  })
  await expect(page).toHaveURL(/\/simulation$/)
  await start!.continue()
})
