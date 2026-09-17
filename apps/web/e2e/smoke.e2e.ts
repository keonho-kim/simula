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
  await page.getByRole("switch", { name: "Auto continue" }).check()
  await page.getByRole("button", { name: "Start", exact: true }).click()

  await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0)

  await expect(page.getByRole("dialog", { name: "Move to the Report page?" })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("heading", { name: "Report", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Open Report" }).click()
  await expect(page.getByRole("tab", { name: "Relationships", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Home" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Relationships" })).toBeVisible()
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("menuitem", { name: "Export Markdown" })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("tab", { name: "Relationships" }).click()
  await page.getByRole("button", { name: "Play replay" }).click()
  await expect(page.getByLabel("Replay timeline")).toBeEnabled()
  await page.getByRole("tab", { name: "Conversations", exact: true }).click()
  await expect(page.getByRole("region", { name: "Round board" })).toBeVisible()
  await page.getByRole("tab", { name: "Performance", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Calls by role" })).toBeVisible()
})

test("supports scenario builder, samples, history, and Korean locale", async ({ page }) => {
  await setUnitTestApiKeys(page)

  await page.addInitScript(() => {
    localStorage.setItem("simula.language", "ko")
  })
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "시뮬레이션 시작하기" })).toBeVisible()

  await page.getByRole("button", { name: /새 시나리오 만들기/ }).click()
  await page.getByLabel("만들고 싶은 상황").fill("시장이 재난 대피 결정을 미루는 상황")
  await page.getByRole("button", { name: "초안 만들기" }).click()
  await expect(page.getByRole("heading", { name: "Scenario Draft", exact: true })).toBeVisible()
  await expect(page.getByText("대화 내역")).toBeVisible()
  await expect(page.getByLabel("수정 요청")).toBeVisible()
  const storyBuilderSession = await page.evaluate(() =>
    localStorage.getItem("simula.story-builder.session")
  )
  expect(storyBuilderSession).toContain("시장이 재난 대피 결정을 미루는 상황")
  await page.getByRole("button", { name: "초안 확인" }).click()
  const storyPreview = page.getByRole("dialog", { name: "시나리오 미리보기" })
  await expect(storyPreview).toBeVisible()
  await expect(storyPreview.getByRole("heading", { name: "Scenario Draft", exact: true })).toBeVisible()
  await expect(storyPreview.getByLabel("등장 인원")).toBeVisible()
  await expect(storyPreview.getByLabel("최대 라운드")).toBeVisible()
  await expect(storyPreview.getByRole("button", { name: "설정" })).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: /예시 시나리오 실행/ }).click()
  await expect(page.getByRole("dialog", { name: "예시 시나리오" })).toBeVisible()
  await page.getByRole("button", { name: "불러오기" }).first().click()
  const samplePreview = page.getByRole("dialog", { name: "시나리오 미리보기" })
  await expect(samplePreview).toBeVisible()
  await expect(samplePreview.getByText(/\.md/).first()).toBeVisible()
  await expect(samplePreview.getByLabel("최대 라운드")).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: /실행 내역 보기/ }).click()
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
