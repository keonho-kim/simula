/**
 * Purpose: Verify source-grounded scenario construction and independent recovery.
 * Pattern: Workflow contract tests.
 * Usage: bun test src/backend/core/scenario-builder/graph.test.ts
 * Related: src/backend/core/scenario-builder/graph.ts, src/backend/core/generation/tasks.ts
 */
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { expect, test } from "bun:test"
import { buildScenario } from "./graph"
import { parseBuilderRequest } from "./contracts"
import type { BuilderDependencies } from "./contracts"
import type { AcceptedGenerationTask, GenerationCall } from "@/backend/core/generation/tasks"
import type { EvidenceBlock } from "@/shared/documents"
import type { GenerationEvent } from "@/shared/generation"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { ScenarioBuilderJobs } from "@/backend/runtime/scenario-builder/jobs"
import { extractTextEvidence } from "@/backend/core/documents/text"
import { defaultSettings } from "@/backend/core/settings/defaults"

const documentId = "11111111-1111-4111-8111-111111111111"
const secondDocumentId = "22222222-2222-4222-8222-222222222222"
const setId = "33333333-3333-4333-8333-333333333333"
const buildId = "44444444-4444-4444-8444-444444444444"
const block = (id: string): EvidenceBlock => ({ id: `${id}:text:0`, documentId: id, kind: "text", method: "native",
  content: "The approved budget is 120. The team must decide whether to proceed.",
  locator: { kind: "text", startLine: 1, endLine: 1, startOffset: 0, endOffset: 78 } })

function fixture() {
  const accepted = new Map<string, AcceptedGenerationTask>()
  const calls: GenerationCall[] = []
  const events: GenerationEvent[] = []
  const signal = new AbortController()
  const dependencies: BuilderDependencies = {
    modelRevision: "test-model-v1", signal: signal.signal,
    readEvidence: async id => [block(id)],
    readTask: async id => accepted.get(id),
    saveTask: async value => { accepted.set(value.id, structuredClone(value)) },
    emit: async event => { events.push(event) },
    invoke: async call => {
      calls.push(call)
      const situationFields: Record<string, string> = { "situation-title": "Investment review",
        "situation-purpose": "Evaluate the proposal.", "situation-decision": "Proceed or request changes.",
        "situation-setting": "Budget review meeting." }
      if (call.id in situationFields) return { text: situationFields[call.id]!, truncated: false }
      const participantFields: Record<string, string> = { personality: "Asks for evidence and acknowledges uncertainty.",
        authority: "Recommends a decision.", goal: "Find a feasible outcome." }
      const participantField = call.id.match(/^participant-\d+-(personality|authority|goal)$/)?.[1]
      if (participantField) {
        const text = participantFields[participantField]!
        await call.onDelta(text)
        return { text, truncated: false }
      }
      if (call.id === "roster-count" || call.id.startsWith("roster-name-")) {
        const text = call.id === "roster-count" ? "2" : call.id === "roster-name-1" ? "Technical lead" : "Finance representative"
        await call.onDelta(text)
        return { text, truncated: false }
      }
      const output = call.id.includes("-claim-") ? call.prompt.includes("May 12")
        ? "The meeting starts on May 12." : "The approved budget is 120."
        : call.id.endsWith("-summary") ? "A budget decision is pending."
        : call.id.endsWith("-gap") ? "0"
        : call.id.endsWith("-select") ? "1"
        : call.kind === "facet" ? "Review whether the proposal fits the budget."
        : call.kind === "rules" ? call.id === "rule-information"
          ? "Finance initially knows the documented budget; other participants learn it only through disclosure."
          : "Record the decision and its conditions."
        : call.kind === "source-access" ? "2"
        : { issues: [] }
      const text = typeof output === "string" ? output : JSON.stringify(output)
      await call.onDelta(text)
      return { text, truncated: false }
    },
  }
  const request = parseBuilderRequest({ documentSetId: setId, documentRevision: 2, language: "en", fastMode: true,
    participants: [{ name: " CTO ", personality: "Questions unsupported estimates." }, { name: "Finance" }] })
  return { dependencies, accepted, calls, events, signal, request }
}

test("builds a compact, source-linked scenario while preserving user identities and traits", async () => {
  const f = fixture()
  const result = await buildScenario(buildId, f.request, [documentId], f.dependencies)
  expect(result.status).toBe("review")
  expect(result.participants.map(value => value.name)).toEqual(["CTO", "Finance"])
  expect(result.participants[0].personality).toBe("Questions unsupported estimates.")
  expect(result.participants[0].nameLocked).toBe(true)
  expect(result.participants[1].personalityLocked).toBe(false)
  expect(f.calls.filter(call => call.id.startsWith("participant-1-")).map(call => call.id)).toEqual(["participant-1-authority", "participant-1-goal"])
  expect(f.calls.filter(call => call.id.startsWith("participant-2-")).map(call => call.id)).toEqual(["participant-2-personality", "participant-2-authority", "participant-2-goal"])
  expect(f.calls.filter(call => call.kind === "participant").every(call => !call.prompt.includes("Required JSON shape"))).toBe(true)
  expect(result.sourceEvidenceIds).toEqual([block(documentId).id])
  expect(result.sourceFacts).toEqual([{ id: "fact-1", text: "The approved budget is 120.",
    evidenceIds: [block(documentId).id], audience: { kind: "participants", participantIds: ["participant-2"] } }])
  expect(f.calls.filter(call => call.id === "source-access-fact-1")).toHaveLength(1)
  expect(f.calls.filter(call => call.kind === "facet" || call.kind === "rules")
    .every(call => call.prompt.includes("Allowed answer:") && !call.prompt.includes("Required JSON shape"))).toBe(true)
  expect(result.facets.goals.assumptions).toContain(result.facets.goals.summary)
  expect(f.calls.every(call => call.maxOutputTokens === 2_048)).toBe(true)
  expect(f.events.some(event => event.type === "draft")).toBe(true)
  const callCount = f.calls.length
  expect(await buildScenario(buildId, f.request, [documentId], f.dependencies)).toEqual(result)
  expect(f.calls.length).toBe(callCount)
})

test("assigns source references in code instead of accepting model-authored references", async () => {
  const f = fixture()
  const result = await buildScenario(buildId, f.request, [documentId], f.dependencies)
  expect(result.status).toBe("review")
  expect(result.sourceFacts[0]?.evidenceIds).toEqual([block(documentId).id])
  expect(f.calls.filter(call => call.kind === "evidence").every(call => !call.prompt.includes("Required JSON shape"))).toBe(true)
})

test("retries a source claim whose number is absent from its cited block", async () => {
  const f = fixture()
  const original = f.dependencies.invoke
  let invalid = true
  f.dependencies.invoke = async call => {
    if (call.id.endsWith("-claim-1") && invalid) {
      invalid = false
      f.calls.push(call)
      return { text: "The approved budget is 999.", truncated: false }
    }
    return original(call)
  }
  const result = await buildScenario(buildId, f.request, [documentId], f.dependencies)
  expect(result.status).toBe("review")
  expect(f.calls.filter(call => call.id.endsWith("-claim-1"))).toHaveLength(2)
  expect(f.events.some(event => event.type === "task" && event.status === "retrying" && event.issue?.includes("999"))).toBe(true)
})

test("a number in another block cannot support the cited claim", async () => {
  const f = fixture()
  const other = { ...block(documentId), id: `${documentId}:text:1`, content: "The meeting starts on May 12." }
  f.dependencies.readEvidence = async () => [block(documentId), other]
  const original = f.dependencies.invoke
  let invalid = true
  f.dependencies.invoke = async call => {
    if (call.id.endsWith("-claim-2") && invalid) {
      invalid = false
      f.calls.push(call)
      return { text: "The approved budget is 120.", truncated: false }
    }
    return original(call)
  }
  expect((await buildScenario(buildId, f.request, [documentId], f.dependencies)).status).toBe("review")
  expect(f.calls.filter(call => call.id.endsWith("-claim-2"))).toHaveLength(2)
})

test("retries an invented number introduced while reducing accepted claims", async () => {
  const f = fixture()
  const original = f.dependencies.invoke
  let invalid = true
  f.dependencies.invoke = async call => {
    if (call.kind === "digest" && call.id.endsWith("-summary") && invalid) {
      invalid = false
      f.calls.push(call)
      return { text: "The budget is 999.", truncated: false }
    }
    return original(call)
  }
  const result = await buildScenario(buildId, f.request, [documentId], f.dependencies)
  expect(result.status).toBe("review")
  expect(f.calls.filter(call => call.id.endsWith("-claim-1"))).toHaveLength(1)
  expect(f.calls.filter(call => call.kind === "digest")).toHaveLength(3)
})

test("standard mode keeps scenario generation serial", async () => {
  const f = fixture()
  f.request.fastMode = false
  const original = f.dependencies.invoke
  let active = 0
  let peak = 0
  f.dependencies.invoke = async call => {
    active++
    peak = Math.max(peak, active)
    try { await Promise.resolve(); return await original(call) }
    finally { active-- }
  }
  expect((await buildScenario(buildId, f.request, [documentId], f.dependencies)).status).toBe("review")
  expect(peak).toBe(1)
})

test("one document digest progresses while another document's evidence is held", async () => {
  const f = fixture()
  const held = Promise.withResolvers<void>()
  const firstDigest = Promise.withResolvers<void>()
  const original = f.dependencies.invoke
  f.dependencies.invoke = async call => {
    if (call.kind === "evidence" && call.evidenceIds.includes(block(secondDocumentId).id)) await held.promise
    const result = await original(call)
    if (call.kind === "digest" && call.id.includes(documentId)) firstDigest.resolve()
    return result
  }
  const work = buildScenario(buildId, f.request, [documentId, secondDocumentId], f.dependencies)
  try {
    await firstDigest.promise
    expect(f.calls.some(call => call.kind === "situation")).toBe(false)
  } finally { held.resolve() }
  expect((await work).status).toBe("review")
})

test("omitted cast generates participant records with unlocked names and traits", async () => {
  const f = fixture()
  f.request.participants = []
  const result = await buildScenario(buildId, f.request, [documentId], f.dependencies)
  expect(result.participants.map(value => value.name)).toEqual(["Technical lead", "Finance representative"])
  expect(result.participants.every(value => !value.nameLocked && !value.personalityLocked && value.personality.length > 0)).toBe(true)
  expect(f.calls.filter(value => value.kind === "roster").map(value => value.id)).toEqual(["roster-count", "roster-name-1", "roster-name-2"])
  expect(f.calls.filter(value => value.kind === "roster").every(value => !value.prompt.includes("Required JSON shape"))).toBe(true)
})

test("cancellation prevents accepting a late output", async () => {
  const f = fixture()
  const original = f.dependencies.invoke
  f.dependencies.invoke = async call => {
    const result = await original(call)
    f.signal.abort(new Error("Canceled"))
    return result
  }
  await expect(buildScenario(buildId, f.request, [documentId], f.dependencies)).rejects.toThrow("Canceled")
  expect(f.accepted.size).toBe(0)
})

test("rejects incomplete text within a fixed retry budget", async () => {
  const f = fixture()
  f.dependencies.invoke = async call => {
    f.calls.push(call)
    return { text: "", truncated: false }
  }
  await expect(buildScenario(buildId, f.request, [documentId], f.dependencies)).rejects.toThrow("3 attempts")
  expect(f.calls).toHaveLength(3)
  expect(f.accepted.size).toBe(0)
  const clipped = fixture()
  clipped.dependencies.invoke = async call => {
    clipped.calls.push(call)
    return { text: "The approved budget is 120.", truncated: true }
  }
  await expect(buildScenario(buildId, clipped.request, [documentId], clipped.dependencies)).rejects.toThrow("3 attempts")
  expect(clipped.calls).toHaveLength(3)
  expect(clipped.accepted.size).toBe(0)
})

test("normalizes optional participant rows and rejects ambiguous identities", () => {
  expect(parseBuilderRequest({ documentSetId: setId, documentRevision: 1, participants: [{ name: " " }] }).participants).toEqual([])
  expect(() => parseBuilderRequest({ documentSetId: setId, documentRevision: 1, participants: [{ name: "", personality: "Careful" }] })).toThrow()
  expect(() => parseBuilderRequest({ documentSetId: setId, documentRevision: 1, participants: [{ name: "CTO" }, { name: " cto " }] })).toThrow()
})

test("runtime persists a reviewable build and confirms its captured source revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-builder-review-"))
  try {
    const f = fixture()
    const documents = new DocumentStore(join(root, "documents"))
    const store = new ScenarioBuildStore(join(root, "builders"))
    const set = await documents.createSet()
    const bytes = new TextEncoder().encode("Budget 120. Decide whether to proceed.")
    const document = await documents.addFile(set.id, "brief.txt", bytes)
    await documents.saveExtraction(set.id, document.id, extractTextEvidence(document.id, bytes))
    const revision = (await documents.readSet(set.id)).revision
    const request = { ...f.request, documentSetId: set.id, documentRevision: revision }
    await store.create(buildId, request)
    const settings = defaultSettings()
    settings.roles.storyBuilder.provider = "lmstudio"
    const jobs = new ScenarioBuilderJobs(store, documents, async () => settings, new ModelAdmission({ concurrency: 8 }), () => f.dependencies.invoke)
    await jobs.start(buildId).completion
    expect(await store.read(buildId)).toMatchObject({ status: "review" })
    const confirmed = await jobs.confirm(buildId)
    expect(confirmed.status).toBe("confirmed")
    expect(confirmed.specification?.participants[0].name).toBe("CTO")
    const reopened = new ScenarioBuildStore(join(root, "builders"))
    expect((await reopened.read(buildId)).specification).toEqual(confirmed.specification)
    const secondId = crypto.randomUUID()
    await store.create(secondId, request)
    await jobs.start(secondId).completion
    await documents.addFile(set.id, "new-source.txt", bytes)
    const retained = await jobs.confirm(secondId)
    expect(retained.specification?.documentRevision).toBe(request.documentRevision)
    expect(retained.status).toBe("confirmed")
    expect((await store.read(secondId)).specification).toEqual(retained.specification)
  } finally { await rm(root, { recursive: true, force: true }) }
})
