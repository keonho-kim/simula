/**
 * Purpose: Verify scoped generation previews never duplicate or retain superseded drafts.
 * Pattern: Reducer contract tests.
 * Usage: bun test src/ui/models/generation/progress.test.ts
 * Related: src/ui/models/generation/progress.ts
 */
import { expect, test } from "bun:test"
import { emptyGenerationProgress, reduceGenerationProgress } from "./progress"
import { projectGenerationFields } from "@/shared/generation-preview"

const executionId = "11111111-1111-4111-8111-111111111111"
test("snapshot plus deltas replace retries and flag gaps without repeating content", () => {
  let state = reduceGenerationProgress(emptyGenerationProgress(), { type: "snapshot", executionId, tasks: [], draft: { type: "draft", taskId: "situation", attempt: 1, sequence: 1, fields: [{ key: "summary", text: "old" }] } })
  const delta = { type: "event", executionId, event: { type: "draft", taskId: "situation", attempt: 1, sequence: 2, fields: [{ key: "summary", text: "old value" }] } }
  state = reduceGenerationProgress(state, delta)
  expect(reduceGenerationProgress(state, delta).draft?.fields).toEqual([{ key: "summary", text: "old value" }])
  state = reduceGenerationProgress(state, { type: "event", executionId, event: { type: "task", taskId: "situation", kind: "situation", attempt: 2, status: "running" } })
  expect(state.draft).toBeUndefined()
  expect(reduceGenerationProgress(state, delta).draft).toBeUndefined()
  state = reduceGenerationProgress(state, { type: "event", executionId, event: { ...delta.event, attempt: 2, sequence: 2 } })
  expect(state.resync).toBe(true)
})

test("accepted plain text and named prose fields render without internal identifiers", () => {
  expect(projectGenerationFields({ summary: "예산 검토를 시작" })).toEqual([{ key: "summary", text: "예산 검토를 시작" }])
  expect(projectGenerationFields({ evidenceIds: ["secret-id"], claims: [{ text: "근거 확인" }] })).toEqual([{ key: "claims", text: "근거 확인" }])
  expect(projectGenerationFields("unstructured text")).toEqual([{ key: "content", text: "unstructured text" }])
})

test("queued model work remains visible and changes to running after admission", () => {
  const task = { type: "task", taskId: "situation", kind: "situation", attempt: 1, status: "waiting" }
  const waiting = reduceGenerationProgress(emptyGenerationProgress(), { type: "snapshot", executionId, tasks: [task] })
  expect(waiting.resync).toBe(false)
  expect(waiting.tasks[0]?.status).toBe("waiting")
  const running = reduceGenerationProgress(waiting, { type: "event", executionId, event: { ...task, status: "running" } })
  expect(running.tasks).toHaveLength(1)
  expect(running.tasks[0]?.status).toBe("running")
})

test("analytical task previews use the same validated stream and retain an active task across sibling completions", () => {
  const active = { type: "task", taskId: "strengths-detail", kind: "report-detail", attempt: 1, status: "running" }
  let state = reduceGenerationProgress(emptyGenerationProgress(), { type: "snapshot", executionId, tasks: [active] })
  expect(state.resync).toBe(false)
  for (let index = 0; index < 100; index++) state = reduceGenerationProgress(state, { type: "event", executionId,
    event: { ...active, taskId: `summary-${index}`, kind: "report-evidence", status: "completed" } })
  expect(state.tasks).toHaveLength(64)
  expect(state.tasks.some(task => task.taskId === active.taskId)).toBe(true)
})
