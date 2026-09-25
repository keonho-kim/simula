/**
 * Purpose: Verify shared scenario ownership, remote cancellation, and immediate-cancel races.
 * Pattern: Runtime concurrency integration tests.
 * Usage: bun test src/backend/runtime/scenario-builder/ownership.test.ts
 * Related: src/backend/runtime/scenario-builder/jobs.ts, src/backend/storage/generation/execution-lease.ts
 */
import { ExecutionOwnership } from "@/backend/storage/generation/execution-lease"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { extractTextEvidence } from "@/backend/core/documents/text"
import { parseBuilderRequest } from "@/backend/core/scenario-builder/contracts"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { testScenarioBuilderResponse } from "@/backend/integrations/llm/testing/scenario-builder-response"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { routeScenarioBuilder } from "@/backend/api/scenario-builder/scenario-builder-controller"
import { ScenarioBuilderJobs } from "./jobs"

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "simula-builder-owner-"))
  const documents = new DocumentStore(join(root, "documents"))
  const store = new ScenarioBuildStore(join(root, "scenarios"))
  const set = await documents.createSet()
  const bytes = new TextEncoder().encode("Review the investment conditions against the supplied materials.")
  const file = await documents.addFile(set.id, "source.txt", bytes)
  await documents.saveExtraction(set.id, file.id, extractTextEvidence(file.id, bytes))
  const revision = (await documents.readSet(set.id)).revision
  const id = crypto.randomUUID()
  await store.create(id, parseBuilderRequest({ documentSetId: set.id, documentRevision: revision, language: "en" }))
  const settings = defaultSettings(); settings.providers.openai.apiKey = "unit-test-api-key"
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let calls = 0
  const createJobs = () => new ScenarioBuilderJobs(new ScenarioBuildStore(store.rootDir), documents, async () => settings,
    new ModelAdmission({ concurrency: 1 }), () => async call => {
      calls++; entered.resolve(); await release.promise
      const text = testScenarioBuilderResponse(call.prompt)
      if (!text) throw new Error("Unknown test generation contract")
      return { text, truncated: false }
    })
  return { root, store, id, file, entered, release, createJobs, calls: () => calls,
    close: () => rm(root, { recursive: true, force: true }) }
}

test("another runtime sees active ownership, avoids duplicate calls and can cancel the owner", async () => {
  const f = await fixture()
  let work: Promise<void> | undefined
  try {
    const first = f.createJobs(), second = f.createJobs()
    work = first.start(f.id).completion
    await f.entered.promise
    const competing = second.start(f.id)
    expect(competing.alreadyRunning).toBe(true)
    await competing.completion
    expect(f.calls()).toBe(1)
    const request = new Request(`http://localhost/api/scenario-builder/${f.id}`)
    expect((await (await routeScenarioBuilder(second, request, new URL(request.url))).json()).build.status).toBe("running")
    expect(second.cancel(f.id)).toBe(true)
    f.release.resolve(); await work
    expect((await f.store.read(f.id)).status).toBe("canceled")
    expect(await f.store.readTask(f.id, `evidence-${f.file.id}-0`)).toBeUndefined()
    expect(second.isRunning(f.id)).toBe(false)
  } finally { f.release.resolve(); await work; await f.close() }
})

test("cancel immediately after start persists cancellation without admitting model work", async () => {
  const f = await fixture()
  let work: Promise<void> | undefined
  try {
    const jobs = f.createJobs()
    work = jobs.start(f.id).completion
    expect(jobs.cancel(f.id)).toBe(true)
    await work
    expect((await f.store.read(f.id)).status).toBe("canceled")
    expect(f.calls()).toBe(0)
  } finally { f.release.resolve(); await work?.catch(() => undefined); await f.close() }
})

test("a displaced scenario worker cannot replace the successor manifest with success or failure", async () => {
  const f = await fixture()
  let work: Promise<void> | undefined
  try {
    work = f.createJobs().start(f.id).completion
    await f.entered.promise
    const replacement = new ExecutionOwnership(join(f.store.rootDir, f.id), () => Date.now() + 60_000).claim()
    if (!replacement) throw new Error("Missing replacement claim")
    const record = await f.store.read(f.id)
    await f.store.write({ ...record, status: "failed", issue: "Replacement owns this run." }, replacement)
    f.release.resolve(); await work
    expect((await f.store.read(f.id)).issue).toBe("Replacement owns this run.")
    expect(await f.store.readTask(f.id, `evidence-${f.file.id}-0`)).toBeUndefined()
    expect(f.store.execution(f.id).isActive()).toBe(true)
    replacement.release()
  } finally { f.release.resolve(); await work; await f.close() }
})
