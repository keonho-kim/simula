/**
 * Purpose: Check bundled examples remain compact, internally consistent inputs for both launch paths.
 * Pattern: Scenario content contract tests.
 * Usage: bun test packages/core/tests/scenario-samples.test.ts
 * Related: senario.samples/README.md, src/backend/storage/samples.ts, src/ui/browser-storage/database/samples/title.ts
 */
import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { listScenarioSamples, readScenarioSample } from "@/backend/storage/samples"
import { titleFromText } from "@/ui/browser-storage/database/samples/title"

const root = fileURLToPath(new URL("../../../senario.samples", import.meta.url))
const sections = ["목적과 결정할 일", "제공 자료", "자료 해석과 미확인 사항", "등장인물", "선택 가능한 행동과 권한", "조건에 따른 전개", "진행과 종료", "결과에서 확인할 것", "멀티버스 비교"]
const samples = await listScenarioSamples(root)
for (const sample of samples) test(`${sample.name}: grounded, bounded example with consistent cast and title`, async () => {
  const detail = await readScenarioSample(root, sample.name)
  expect(detail.text.match(/^# /gm)).toHaveLength(1)
  expect(titleFromText(detail.text, detail.name)).toBe(detail.title)
  expect(detail.controls.numCast).toBeGreaterThanOrEqual(3)
  expect(detail.controls.numCast).toBeLessThanOrEqual(6)
  expect(detail.controls.allowAdditionalCast).toBe(false)
  expect(detail.controls.maxRound).toBe(4)
  expect(detail.controls.actionsPerType).toBe(2)
  expect(detail.controls.fastMode).toBe(false)
  expect(detail.controls.autonomousProgress).toBe(false)
  expect(detail.controls.outputLength).toBe("short")
  expect(detail.text.length).toBeLessThan(10_000)
  for (const heading of sections) expect(detail.text).toContain(`## ${heading}\n`)
  const cast = detail.text.split("## 등장인물\n")[1]?.split("\n## ")[0] ?? ""
  const names = [...cast.matchAll(/^- ([^:]+):/gm)].map(match => match[1])
  expect(names.length).toBe(detail.controls.numCast)
  expect(new Set(names).size).toBe(names.length)
  const sourceLabels = [...detail.text.matchAll(/^### (자료 \d+) ·/gm)].map(match => match[1])
  expect(sourceLabels.length).toBeGreaterThanOrEqual(3)
  expect(new Set(sourceLabels).size).toBe(sourceLabels.length)
  for (const reference of detail.text.matchAll(/자료 \d+/g)) expect(sourceLabels).toContain(reference[0])
  expect(detail.text).toContain("가상")
  expect(detail.text).not.toContain("# 시나리오 ")
})
