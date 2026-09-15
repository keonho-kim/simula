import { expect, test, type Route } from "@playwright/test"

test("preparation covers the viewport, scrolls internally, and closes when the run begins", async ({ page }, testInfo) => {
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
      { ...base, type: "model.message", role: "planner", content: `actorPressures: ${"인물들은 서로 다른 입장을 가지고 있습니다.\n\n".repeat(100)}` },
    ])
  })
  const dialog = page.getByRole("dialog", { name: "진행 준비", exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("heading", { name: "Actor Pressures", exact: true })).toBeVisible()
  await expect(dialog.getByRole("article").getByText("기획", { exact: true })).toHaveCount(0)
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
  await page.screenshot({ path: testInfo.outputPath("preparation-desktop.png") })
  await page.setViewportSize({ width: 390, height: 600 })
  await expect.poll(async () => (await dialog.boundingBox())!.height).toBeLessThanOrEqual(568)
  const mobile = (await dialog.boundingBox())!
  expect(mobile.y).toBeGreaterThanOrEqual(0)
  expect(mobile.y + mobile.height).toBeLessThanOrEqual(600)
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  const content = dialog.locator('.overflow-auto')
  expect(await content.evaluate(element => element.clientHeight > 0 && element.scrollHeight > element.clientHeight)).toBe(true)
  await content.evaluate(element => { element.scrollTop = element.scrollHeight })
  expect(await content.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath("preparation-mobile.png") })
  await start!.continue()
  await expect(dialog).toBeHidden({ timeout: 20000 })
  await page.getByRole("button", { name: "계속 보기", exact: true }).click()
  await expect(page.getByRole("complementary").getByRole("article").first()).toBeVisible()
})
