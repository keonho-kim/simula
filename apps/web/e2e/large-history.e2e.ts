/**
 * Purpose: Verify long actor histories stay bounded and scroll correctly.
 * Pattern: End-to-end workflow test.
 * Usage: Executed by Playwright through bun run test:e2e.
 * Related: src/ui/components/actors/actor-rail.tsx, src/ui/shell/home-view.tsx
 */
import { expect, test } from "./fixtures"

test("large history bounds mounted DOM while retaining scroll access and follow-latest behavior", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /Import finished scenario/ }).click()
  await (await chooser).setFiles({ name: "large-history.md", mimeType: "text/markdown", buffer: Buffer.from("A team discusses a release.") })
  await page.getByLabel("Cast size").fill("3")
  await page.getByLabel("Max round").fill("1")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await page.getByRole("button", { name: "Keep watching" }).click()
  const inject = async (start: number, count: number) => page.evaluate(async ({ start, count }) => {
    const path = "/src/ui/stores/run-store.ts"
    const { useRunStore } = await window.__simulaE2E!.import(path)
    const store = useRunStore.getState()
    store.pushEvents(Array.from({ length: count }, (_, offset) => {
      const index = start + offset
      return { type: "interaction.recorded", runId: store.selectedRunId, timestamp: new Date(1700000000000 + index).toISOString(), interaction: {
        id: `history-${index}`, roundIndex: 100 + Math.floor(index / 20), sourceActorId: "actor-1", targetActorIds: [], eventId: "e", visibility: "public", decisionType: "action", actionType: "Record", content: `HISTORY ${index}`, thought: "Variable height content. ".repeat(index % 5 + 1), intent: "", expectation: "",
      } }
    }))
  }, { start, count })
  await inject(0, 4000)
  const rail = page.getByRole("complementary", { name: "Actor history" })
  await expect(rail.locator('[data-slot="scroll-area-viewport"]')).toHaveCount(0)
  const gap = () => page.evaluate(() => document.documentElement.scrollHeight - scrollY - innerHeight)
  await expect(rail.getByText("HISTORY 3999", { exact: true })).toBeVisible()
  await expect.poll(gap).toBeLessThanOrEqual(1)
  const mounted = await rail.getByRole("article").count()
  expect(mounted).toBeLessThan(40)
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(rail.getByText("HISTORY 0", { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await inject(4000, 100)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(rail.getByText("HISTORY 4099", { exact: true })).toBeVisible()
  await expect.poll(gap).toBeLessThanOrEqual(1)
  await inject(4100, 20)
  await expect(rail.getByText("HISTORY 4119", { exact: true })).toBeVisible()
  await expect.poll(gap).toBeLessThanOrEqual(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(gap).toBeLessThanOrEqual(1)
  expect(await rail.getByRole("article").count()).toBeLessThan(40)
  expect(errors).toEqual([])
  await testInfo.attach("virtual-history", { body: JSON.stringify({ injectedMessages: 4120, mountedAt4000: mounted }), contentType: "application/json" })
  console.log("Virtual history:", JSON.stringify({ injectedMessages: 4120, mountedAt4000: mounted }))
})
