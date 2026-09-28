/**
 * Purpose: Verify report task grouping, readable subtasks, and retry identity.
 * Pattern: Pure presentation contract tests.
 * Usage: Executed by bun test.
 * Related: src/ui/models/report/preparation-groups.ts
 */
import { expect, test } from "bun:test"
import { dictionary } from "@/ui/i18n/dictionary"
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import { groupPreparationTasks } from "./preparation-groups"

const task = (taskId: string, kind: GenerationTaskView["kind"] = "perspective", status: GenerationTaskView["status"] = "completed", attempt = 1): GenerationTaskView =>
  ({ type: "task", taskId, kind, status, attempt })

test("parallel evidence and perspective tasks become two groups with distinct ordered subtasks", () => {
  const groups = groupPreparationTasks([
    task("perspective-boundary"), task("scenario-context-evidence-0", "report-evidence"),
    task("perspective-focus"), task("perspective-objective"), task("perspective-horizon", "perspective", "running"),
    task("world-abc-evidence-0", "report-evidence"),
  ], true, dictionary.ko)
  expect(groups).toHaveLength(2)
  const perspective = groups.find(group => group.id === "evidence:perspective")!
  expect(perspective.tasks.map(item => item.subtitle)).toEqual(["분석 대상", "평가 목적", "평가 기간", "평가 범위"])
  expect(perspective.completed).toBe(3)
  expect(perspective.status).toBe("running")
  expect(groups.find(group => group.id === "evidence:evidence")?.tasks).toHaveLength(2)
})

test("retry replaces the prior attempt without changing the group or inflating progress", () => {
  const groups = groupPreparationTasks([task("strengths-score", "swot"), task("strengths-score", "swot", "retrying", 2)], true, dictionary.en)
  expect(groups).toHaveLength(1)
  expect(groups[0]?.tasks).toHaveLength(1)
  expect(groups[0]?.completed).toBe(0)
  expect(groups[0]?.status).toBe("retrying")
})

test("finding source and text, summaries and detailed conclusions have distinct subtitles", () => {
  const groups = groupPreparationTasks([
    task("strengths-finding-1-source", "swot"), task("strengths-finding-1-text", "swot"),
    task("conclusion-source-summary", "conclusion"), task("conclusion-source-content", "conclusion"),
  ], true, dictionary.ko)
  for (const group of groups) expect(new Set(group.tasks.map(item => item.subtitle)).size).toBe(group.tasks.length)
  expect(groups.map(group => group.stage)).toEqual(["analysis", "synthesis"])
})


test("separate source batches receive distinguishable subtitles", () => {
  const [group] = groupPreparationTasks([
    task("world-abc-evidence-0", "report-evidence"), task("world-def-evidence-0", "report-evidence"),
  ], true, dictionary.ko)
  expect(group?.tasks.map(item => item.subtitle)).toEqual(["시뮬레이션 기록 1 · 근거 묶음 1", "시뮬레이션 기록 2 · 근거 묶음 1"])
})
