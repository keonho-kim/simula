/**
 * Purpose: Verify persisted builder execution, idempotency, recovery, and confirmation gates.
 * Pattern: HTTP and runtime integration tests.
 * Usage: bun test src/backend/api/scenario-builder/scenario-builder-controller.test.ts
 * Related: src/backend/api/scenario-builder/scenario-builder-controller.ts, src/backend/runtime/scenario-builder/jobs.ts
 */
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { ScenarioBuilderJobs } from "@/backend/runtime/scenario-builder/jobs"
import { extractTextEvidence } from "@/backend/core/documents/text"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { routeScenarioBuilder } from "./scenario-builder-controller"

test("builder start is idempotent and canceled work remains retryable without accepting late output", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-builder-api-"))
  try {
    const documents = new DocumentStore(join(root, "documents"))
    const store = new ScenarioBuildStore(join(root, "builders"))
    const source = await documents.createSet()
    const bytes = new TextEncoder().encode("Budget: 120. Decide whether to proceed.")
    const file = await documents.addFile(source.id, "budget.txt", bytes)
    await documents.saveExtraction(source.id, file.id, extractTextEvidence(file.id, bytes))
    const set = await documents.readSet(source.id)
    const settings = defaultSettings()
    settings.roles.storyBuilder.provider = "lmstudio"
    const entered = Promise.withResolvers<void>()
    const held = Promise.withResolvers<void>()
    let calls = 0
    const jobs = new ScenarioBuilderJobs(store, documents, async () => settings, new ModelAdmission({ concurrency: 8 }), () => async () => {
      calls++
      entered.resolve()
      await held.promise
      return { text: "", truncated: false }
    })
    const id = crypto.randomUUID()
    const input = { documentSetId: set.id, documentRevision: set.revision, language: "en" }
    const post = () => new Request("http://localhost/api/scenario-builder", {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": id }, body: JSON.stringify(input),
    })
    const request = post()
    expect((await routeScenarioBuilder(jobs, request, new URL(request.url))).status).toBe(202)
    await entered.promise
    expect((await routeScenarioBuilder(jobs, post(), new URL(request.url))).status).toBe(200)
    expect(calls).toBe(1)
    const completion = jobs.start(id).completion
    expect(jobs.cancel(id)).toBe(true)
    held.resolve()
    await completion
    expect((await store.read(id)).status).toBe("canceled")
    expect(await store.readTask(id, `evidence-${file.id}-0`)).toBeUndefined()
    await expect(jobs.confirm(id)).rejects.toThrow("blocking")
    const retry = new Request(`http://localhost/api/scenario-builder/${id}/retry`, { method: "POST" })
    expect((await routeScenarioBuilder(jobs, retry, new URL(retry.url))).status).toBe(202)
    await jobs.start(id).completion
    expect((await store.read(id)).status).toBe("failed")
    expect(calls).toBe(4)
    const reopened = new ScenarioBuildStore(join(root, "builders"))
    expect((await reopened.read(id)).request.documentSetId).toBe(set.id)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("builder rejects stale sources and oversized input before creating work", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-builder-guard-"))
  try {
    const documents = new DocumentStore(join(root, "documents"))
    const store = new ScenarioBuildStore(join(root, "builders"))
    const jobs = new ScenarioBuilderJobs(store, documents, async () => defaultSettings(), new ModelAdmission({ concurrency: 8 }))
    const source = await documents.createSet()
    const request = new Request("http://localhost/api/scenario-builder", { method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ documentSetId: source.id, documentRevision: source.revision + 1 }) })
    expect((await routeScenarioBuilder(jobs, request, new URL(request.url))).status).toBe(409)
    const large = new Request(request.url, { method: "POST", headers: { "content-length": "1000000", "idempotency-key": crypto.randomUUID() }, body: "{}" })
    expect((await routeScenarioBuilder(jobs, large, new URL(large.url))).status).toBe(413)
  } finally { await rm(root, { recursive: true, force: true }) }
})
