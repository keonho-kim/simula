import { expect, test, type Page } from "@playwright/test"

test("runs the engine flow from settings to report", async ({ page }) => {
  await setUnitTestApiKeys(page)
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Start a simulation" })).toBeVisible()
  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByRole("dialog", { name: "LLM settings" })).toBeVisible()
  await page.keyboard.press("Escape")

  await expect(page.getByRole("button", { name: /New Scenario/ })).toBeVisible()
  const uploadChooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /Upload My Scenario/ }).click()
  const chooser = await uploadChooser
  await chooser.setFiles({
    name: "uploaded-scenario.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("A product team debates a risky release."),
  })
  await expect(page.getByRole("dialog", { name: "Scenario Preview" })).toBeVisible()
  await expect(page.getByText(/risky release/)).toBeVisible()
  await page.getByLabel("Cast size").fill("3")
  await expect(page.getByLabel("Max round")).toHaveValue("8")
  await page.getByLabel("Max round").fill("3")
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible()
  await page.getByRole("button", { name: "Start" }).click()

  await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0)

  await expect(page.getByRole("dialog", { name: "Move to the Report page?" })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("heading", { name: "Report", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Open Report" }).click()
  await expect(page.getByRole("heading", { name: "Report", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Home" })).toBeVisible()
  await expect(page.getByText("# Simula Report")).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("button", { name: "Export Markdown" })).toBeEnabled()
  await page.getByRole("button", { name: "Play replay" }).click()
  await expect(page.getByLabel("Replay timeline")).toBeEnabled()
  await page.getByRole("button", { name: "Maximize replay" }).click()
  await expect(page.getByRole("dialog", { name: "Simulation Replay" })).toBeVisible()
})

test("supports scenario builder, samples, history, and Korean locale", async ({ page }) => {
  await setUnitTestApiKeys(page)

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "language", { value: "ko-KR" })
  })
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "시뮬레이션을 시작하세요" })).toBeVisible()

  await page.getByRole("button", { name: /새 시나리오 만들기/ }).click()
  await page.getByLabel("만들고 싶은 상황").fill("시장이 재난 대피 결정을 미루는 상황")
  await page.getByRole("button", { name: "초안 만들기" }).click()
  await expect(page.getByText("# Scenario Draft")).toBeVisible()
  await expect(page.getByText("대화 내역")).toBeVisible()
  await expect(page.getByLabel("업데이트 요청")).toBeVisible()
  const storyBuilderSession = await page.evaluate(() =>
    localStorage.getItem("simula.story-builder.session")
  )
  expect(storyBuilderSession).toContain("시장이 재난 대피 결정을 미루는 상황")
  await page.getByRole("button", { name: "초안 확인" }).click()
  const storyPreview = page.getByRole("dialog", { name: "시나리오 프리뷰" })
  await expect(storyPreview).toBeVisible()
  await expect(storyPreview.getByText(/시장이 재난/)).toBeVisible()
  await expect(storyPreview.getByLabel("등장 인원")).toBeVisible()
  await expect(storyPreview.getByLabel("Max round")).toBeVisible()
  await expect(storyPreview.getByRole("button", { name: "Settings" })).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: /예시 시나리오 시뮬레이션/ }).click()
  await expect(page.getByRole("dialog", { name: "예시 시나리오" })).toBeVisible()
  await page.getByRole("button", { name: "불러오기" }).first().click()
  const samplePreview = page.getByRole("dialog", { name: "시나리오 프리뷰" })
  await expect(samplePreview).toBeVisible()
  await expect(samplePreview.getByText(/\.md/).first()).toBeVisible()
  await expect(samplePreview.getByLabel("Max round")).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: /실행 내역 복기/ }).click()
  await expect(page.getByRole("dialog", { name: "실행 내역" })).toBeVisible()
})

async function setUnitTestApiKeys(page: Page) {
  const settingsResponse = await page.request.get("/api/settings")
  const { settings } = (await settingsResponse.json()) as {
    settings: { providers: { openai: { apiKey?: string } } }
  }
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
}
