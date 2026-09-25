/**
 * Purpose: Verify document extraction capacity, page evidence, and cancellation.
 * Pattern: Runtime resource-boundary test.
 * Usage: bun test src/backend/runtime/documents.test.ts
 * Related: src/backend/runtime/documents.ts
 */
import { expect, spyOn, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { ModelAdmission } from "./model-admission"
import { DocumentJobs } from "./documents"

test("only two extractions enter and a queued file cancels without waiting for them", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-extraction-capacity-"))
  const release = Promise.withResolvers<void>()
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const bytes = new TextEncoder().encode("Budget review")
    const documents = await Promise.all(["one.txt", "two.txt", "three.txt"].map(name => store.addFile(set.id, name, bytes)))
    const statuses = new Map<string, string>()
    spyOn(store, "readDocument").mockImplementation(async (_setId, id) => {
      const document = documents.find(value => value.id === id)
      if (!document) throw new Error("Missing fixture")
      return document
    })
    spyOn(store, "updateStatus").mockImplementation(async (_setId, id, status) => { statuses.set(id, status) })
    spyOn(store, "saveExtraction").mockImplementation(async (_setId, id) => { statuses.set(id, "ready") })
    const entered = Promise.withResolvers<void>()
    let calls = 0
    const read = spyOn(store, "readOriginal").mockImplementation(async () => {
      calls++
      if (calls === 2) entered.resolve()
      await release.promise
      return bytes
    })
    const settings = defaultSettings(); settings.concurrency = 2
    const jobs = new DocumentJobs(store, "soffice", async () => settings, new ModelAdmission({ concurrency: 2 }))
    const work = documents.map(document => jobs.start(set.id, document.id, true).completion)
    await entered.promise
    expect(calls).toBe(2)
    expect(jobs.cancel(set.id, documents[2].id)).toBe(true)
    await work[2]
    expect(statuses.get(documents[2].id)).toBe("canceled")
    expect(calls).toBe(2)
    release.resolve()
    await Promise.all(work)
    expect(statuses.get(documents[0].id)).toBe("ready")
    read.mockRestore()
  } finally { release.resolve(); await rm(root, { recursive: true, force: true }) }
})

test("standard mode extracts files one at a time even with spare configured capacity", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-extraction-serial-"))
  const release = Promise.withResolvers<void>()
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const documents = await Promise.all(["first.txt", "second.txt"].map(name => store.addFile(set.id, name, new TextEncoder().encode("Evidence"))))
    const entered = Promise.withResolvers<void>()
    let reads = 0
    const read = spyOn(store, "readOriginal").mockImplementation(async () => {
      reads++
      entered.resolve()
      await release.promise
      return new TextEncoder().encode("Evidence")
    })
    const settings = defaultSettings(); settings.concurrency = 4
    const jobs = new DocumentJobs(store, "soffice", async () => settings, new ModelAdmission({ concurrency: 4 }))
    const work = documents.map(document => jobs.start(set.id, document.id, false).completion)
    await entered.promise
    expect(reads).toBe(1)
    release.resolve()
    await Promise.all(work)
    expect(reads).toBe(2)
    read.mockRestore()
  } finally { release.resolve(); await rm(root, { recursive: true, force: true }) }
})

test("one PDF page records its VLM call even when provider token usage is unavailable", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-document-vision-metrics-"))
  const previous = process.env.SIMULA_TEST_MODEL
  process.env.SIMULA_TEST_MODEL = "1"
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const file = await store.addFile(set.id, "scanned-note.pdf",
      await readFile(resolve(import.meta.dir, "../../../sample-input-items/scanned-note.pdf")))
    const settings = defaultSettings()
    settings.providers.openai.apiKey = "unit-test-api-key"
    const jobs = new DocumentJobs(store, "soffice", async () => settings, new ModelAdmission({ concurrency: 1 }))
    await jobs.start(set.id, file.id).completion
    expect((await store.readDocument(set.id, file.id)).status).toBe("ready")
    const calls = await store.readCallRecords(set.id, file.id)
    expect(calls?.metrics).toMatchObject([{ page: 1, metrics: { role: "storyBuilder", tokenSource: "unavailable" } }])
    expect(calls?.failures).toEqual([])
  } finally {
    if (previous === undefined) delete process.env.SIMULA_TEST_MODEL; else process.env.SIMULA_TEST_MODEL = previous
    await rm(root, { recursive: true, force: true })
  }
})

test("a failed admitted PDF vision call retains unknown incurred usage", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-document-vision-failure-"))
  let requests = 0
  const server = Bun.serve({ port: 0, fetch() { requests++; return Response.json({ error: { message: "unavailable" } }, { status: 503 }) } })
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const file = await store.addFile(set.id, "scanned-note.pdf",
      await readFile(resolve(import.meta.dir, "../../../sample-input-items/scanned-note.pdf")))
    const settings = defaultSettings()
    settings.roles.storyBuilder = { ...settings.roles.storyBuilder, provider: "vllm", model: "local" }
    settings.providers.vllm = { apiKey: "test", baseUrl: `http://127.0.0.1:${server.port}/v1` }
    const jobs = new DocumentJobs(store, "soffice", async () => settings, new ModelAdmission({ concurrency: 1 }))
    await jobs.start(set.id, file.id).completion
    expect(requests).toBe(1)
    expect((await store.readDocument(set.id, file.id)).status).toBe("failed")
    const calls = await store.readCallRecords(set.id, file.id)
    expect(calls?.metrics).toEqual([])
    expect(calls?.failures).toMatchObject([{ failure: { taskId: `${file.id}:page:1`, outcome: "failed" } }])
  } finally { await server.stop(true); await rm(root, { recursive: true, force: true }) }
})

test("a model-call log failure cannot silently accept a partially accounted document", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-document-usage-write-"))
  const previous = process.env.SIMULA_TEST_MODEL
  process.env.SIMULA_TEST_MODEL = "1"
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const file = await store.addFile(set.id, "scanned-note.pdf",
      await readFile(resolve(import.meta.dir, "../../../sample-input-items/scanned-note.pdf")))
    const write = spyOn(store, "appendMetrics").mockRejectedValue(new Error("disk full"))
    const settings = defaultSettings()
    settings.providers.openai.apiKey = "unit-test-api-key"
    const jobs = new DocumentJobs(store, "soffice", async () => settings, new ModelAdmission({ concurrency: 1 }))
    await jobs.start(set.id, file.id).completion
    expect(await store.readDocument(set.id, file.id)).toMatchObject({ status: "failed", issue: { code: "usage_record_failed" } })
    write.mockRestore()
  } finally {
    if (previous === undefined) delete process.env.SIMULA_TEST_MODEL; else process.env.SIMULA_TEST_MODEL = previous
    await rm(root, { recursive: true, force: true })
  }
})

const officeIntegration = process.env.SIMULA_OFFICE_INTEGRATION === "1" ? test : test.skip
officeIntegration("all eight small input formats produce evidence and converted pages retain visual interpretation", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-office-pages-"))
  const previous = process.env.SIMULA_TEST_MODEL
  process.env.SIMULA_TEST_MODEL = "1"
  try {
    const store = new DocumentStore(root)
    const set = await store.createSet()
    const settings = defaultSettings()
    settings.providers.openai.apiKey = "unit-test-api-key"
    const jobs = new DocumentJobs(store, "soffice", async () => settings, new ModelAdmission({ concurrency: 1 }))
    for (const name of ["notes.txt", "brief.md", "risks.csv", "overview.docx", "overview.doc", "presentation.pptx", "budget.xlsx", "overview.pdf"]) {
      const file = await store.addFile(set.id, name, await readFile(resolve(import.meta.dir, `../../../sample-input-items/${name}`)))
      await jobs.start(set.id, file.id).completion
      expect((await store.readDocument(set.id, file.id)).status).toBe("ready")
      const evidence = await store.readExtraction(set.id, file.id)
      expect(evidence.blocks.length).toBeGreaterThan(0)
      if (/\.(txt|md|csv)$/.test(name)) continue
      if (name === "budget.xlsx") expect(evidence.blocks.some(block => block.method === "native" && block.locator.kind === "cell"), name).toBe(true)
      else expect(evidence.blocks.some(block => block.method === "pdfjs" && block.locator.kind === "page"), name).toBe(true)
      expect(evidence.blocks.some(block => block.method === "vlm" && block.locator.kind === "page"), name).toBe(true)
      expect((await store.readCallRecords(set.id, file.id))?.metrics.length).toBeGreaterThan(0)
    }
  } finally {
    if (previous === undefined) delete process.env.SIMULA_TEST_MODEL; else process.env.SIMULA_TEST_MODEL = previous
    await rm(root, { recursive: true, force: true })
  }
}, 120_000)
