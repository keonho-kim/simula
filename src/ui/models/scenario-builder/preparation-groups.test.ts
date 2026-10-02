/**
 * Purpose: Verify scenario generation navigation groups targets and distinguishes their steps.
 * Pattern: Pure presentation contract tests.
 * Usage: bun test src/ui/models/scenario-builder/preparation-groups.test.ts
 * Related: src/ui/models/scenario-builder/preparation-groups.ts
 */
import { expect, test } from "bun:test"
import { dictionary } from "@/ui/i18n/dictionary"
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import { groupBuilderTasks } from "./preparation-groups"

const task = (taskId: string, kind: GenerationTaskView["kind"], scope?: GenerationTaskView["scope"],
  status: GenerationTaskView["status"] = "completed", attempt = 1): GenerationTaskView =>
  ({ type: "task", taskId, kind, scope, status, attempt })
const context = { t: dictionary.ko, channel: "scenario-builder" as const, terminal: false }

test("cast selection and each participant are separate targets with named ordered steps", () => {
  const groups = groupBuilderTasks([
    task("roster-name-2", "roster"), task("roster-count", "roster"), task("roster-name-1", "roster"),
    task("participant-2-goal", "participant", { kind: "participant", name: "재무 담당자" }),
    task("participant-1-authority", "participant", { kind: "participant", name: "기술 담당자" }),
    task("participant-1-personality", "participant", { kind: "participant", name: "기술 담당자" }),
    task("participant-1-goal", "participant", { kind: "participant", name: "기술 담당자" }, "running"),
  ], context)
  expect(groups.map(group => group.title)).toEqual(["등장인물 선정", "기술 담당자", "재무 담당자"])
  expect(groups.every(group => group.stage === "participants")).toBe(true)
  expect(groups[0]?.steps.map(step => step.title)).toEqual(["등장 인원 결정", "인물 1 이름 선정", "인물 2 이름 선정"])
  expect(groups[1]?.steps.map(step => step.title)).toEqual(["성격", "의사결정 범위", "당면 목표"])
  expect(groups[1]?.completed).toBe(2)
  expect(groups[1]?.status).toBe("running")
})

test("documents retain separate targets and distinguish claims, summaries, and synthesis", () => {
  const groups = groupBuilderTasks([
    task("evidence-doc-a-0-summary", "evidence", { kind: "document", id: "doc-a" }),
    task("evidence-doc-b-0-claim-1", "evidence", { kind: "document", id: "doc-b" }),
    task("evidence-doc-a-0-gap", "evidence", { kind: "document", id: "doc-a" }),
    task("evidence-doc-a-0-claim-1", "evidence", { kind: "document", id: "doc-a" }),
    task("document-doc-a-digest-0-0-summary", "digest", { kind: "document", id: "doc-a" }),
    task("sources-digest-0-0-summary", "digest"),
  ], { ...context, documentNames: new Map([["doc-a", "예산안.pdf"], ["doc-b", "회의록.md"]]) })
  expect(groups.map(group => group.title)).toEqual(["예산안.pdf", "회의록.md", "자료 종합"])
  expect(new Set(groups[0]?.steps.map(step => step.title)).size).toBe(4)
  expect(groups[0]?.steps[0]?.title).toBe("근거 묶음 1 · 사실 1 확인")
})

test("situation fields, facets, and review rules appear under their actual generation targets", () => {
  const groups = groupBuilderTasks([
    task("situation-setting", "situation"), task("situation-purpose", "situation"), task("situation-title", "situation"),
    task("facet-goals", "facet", { kind: "facet", key: "goals" }),
    task("rule-actions", "rules", { kind: "rule", key: "actions" }),
    task("rule-information", "rules", { kind: "rule", key: "information" }),
    task("source-access-fact-2", "source-access"), task("source-access-fact-1", "source-access"),
  ], context)
  expect(groups.map(group => group.title)).toEqual(["기본 상황", "목표", "시나리오 규칙", "자료 사실 접근 범위"])
  expect(groups[0]?.steps.map(step => step.title)).toEqual(["시나리오", "목적", "시작 상황"])
  expect(groups[2]?.steps.map(step => step.title)).toEqual(["정보 접근 범위", "행동 범위"])
  expect(groups[3]?.steps.map(step => step.title)).toEqual(["자료의 사실 1 · 접근 범위", "자료의 사실 2 · 접근 범위"])
})

test("world preparation groups one person's starting position and concern, using distinct step names", () => {
  const groups = groupBuilderTasks([
    task("concern-participant-1-goal", "participant", { kind: "participant", name: "CTO" }),
    task("actor-participant-1-summary", "participant", { kind: "participant", name: "CTO" }),
  ], { ...context, channel: "worlds", t: dictionary.en, terminal: true })
  expect(groups).toHaveLength(1)
  expect(groups[0]?.title).toBe("CTO")
  expect(groups[0]?.steps.map(step => step.title)).toEqual(["Starting position", "Immediate concern"])
  expect(groups[0]?.status).toBe("completed")
})

test("retry replaces one step without duplicating the target, and unfinished terminal targets are canceled", () => {
  const scope = { kind: "participant" as const, name: "CTO" }
  const previous = task("participant-1-authority", "participant", scope)
  const retry = task(previous.taskId, "participant", scope, "retrying", 2)
  const groups = groupBuilderTasks([retry, previous], context)
  expect(groups).toHaveLength(1)
  expect(groups[0]?.steps).toHaveLength(1)
  expect(groups[0]?.completed).toBe(0)
  expect(groups[0]?.status).toBe("retrying")
  expect(groupBuilderTasks([retry], { ...context, terminal: true })[0]?.status).toBe("canceled")
  expect(groupBuilderTasks([task(previous.taskId, "participant", scope, "failed")], context)[0]?.status).toBe("failed")
})

test("received steps and another stage cannot confirm that a parallel target has finished expanding", () => {
  const completed = task("participant-1-personality", "participant", { kind: "participant", name: "CTO" })
  expect(groupBuilderTasks([completed], context)[0]?.status).toBe("running")
  const later = task("rule-information", "rules", { kind: "rule", key: "information" }, "running")
  expect(groupBuilderTasks([completed, later], context)[0]?.status).toBe("running")
  expect(groupBuilderTasks([completed, later], { ...context, channel: "worlds" })[0]?.status).toBe("running")
  expect(groupBuilderTasks([completed], { ...context, terminal: true })[0]?.status).toBe("completed")
})
