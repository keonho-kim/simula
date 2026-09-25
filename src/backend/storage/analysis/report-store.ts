/**
 * Purpose: Persist analytical reports and discover the latest revision for each run or batch.
 * Pattern: Repository with fenced artifact publication.
 * Usage: Owned by analytical report runtime under the configured data root.
 * Related: src/shared/analytical-report-schema.ts, src/backend/storage/generation/task-artifacts.ts
 */
import { ExecutionOwnership, type ExecutionLease } from "../generation/execution-lease"
import { createHash } from "node:crypto"
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { z } from "zod"
import type { AnalysisRecord, AnalysisReference, AnalysisSubject } from "@/shared/analytical-report"
import type { ModelMetrics } from "@/shared/run"
import { modelCallFailureRecordSchema, type ModelCallFailure } from "@/shared/model-failure"
import type { AcceptedGenerationTask } from "@/backend/core/generation/tasks"
import { analysisMetricCallSchema as metric, analysisRecordSchema, analysisReferenceSchema, analysisSubjectSchema } from "@/shared/analytical-report-schema"
import { readGenerationTask, saveGenerationTask } from "../generation/task-artifacts"
import { isMissingFileError } from "../file-errors"
import { appendModelCallRecord, parseModelCallLog } from "../generation/model-call-log"

const MAX_REPORT_BYTES = 512 * 1024
const MAX_METRICS_BYTES = 4 * 1024 * 1024
const subjectPointer = z.object({ id: z.uuid(), subject: analysisSubjectSchema, createdAt: z.iso.datetime() }).strict()

export class AnalysisStore {
  readonly rootDir: string
  private readonly indexWrites = new Map<string, Promise<void>>()
  constructor(rootDir: string) { this.rootDir = resolve(rootDir) }

  async create(record: AnalysisRecord): Promise<AnalysisRecord> {
    const accepted = analysisRecordSchema.parse(record)
    await mkdir(this.rootDir, { recursive: true })
    const temporary = join(this.rootDir, `.analysis-${crypto.randomUUID()}`)
    await mkdir(temporary)
    let stored = accepted
    try {
      await Promise.all([writeFile(join(temporary, "manifest.json"), JSON.stringify(accepted)), writeFile(join(temporary, "metrics.jsonl"), "")])
      try { await rename(temporary, this.directory(accepted.id)) }
      catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || !["EEXIST", "ENOTEMPTY"].includes(String(error.code))) throw error
        const previous = await this.read(record.id)
        if (JSON.stringify(previous.subject) !== JSON.stringify(record.subject) || previous.inputRevision !== record.inputRevision
          || previous.language !== record.language || previous.fastMode !== record.fastMode) throw new Error("Report idempotency key has different input.", { cause: error })
        stored = previous
      }
      // Repeated creation repairs an interrupted index publication using the original creation time.
      await this.indexSubject(stored)
      return stored
    } finally { await rm(temporary, { recursive: true, force: true }) }
  }
  async latest(subject: AnalysisSubject): Promise<AnalysisRecord | undefined> {
    const path = this.subjectPath(subject)
    let pointer: z.infer<typeof subjectPointer>
    try { pointer = subjectPointer.parse(await this.readJson(path)) }
    catch (error) { if (isMissingFileError(error)) return undefined; throw error }
    const record = await this.read(pointer.id)
    if (pointer.subject.kind !== subject.kind || pointer.subject.id !== subject.id
      || record.subject.kind !== subject.kind || record.subject.id !== subject.id || record.createdAt !== pointer.createdAt) {
      throw new Error("Report subject index identity mismatch.")
    }
    return record
  }
  async read(id: string): Promise<AnalysisRecord> {
    const value = analysisRecordSchema.parse(await this.readJson(join(this.directory(id), "manifest.json")))
    if (value.id !== id) throw new Error("Report identity mismatch.")
    return value
  }
  execution(id: string): ExecutionOwnership { return new ExecutionOwnership(this.directory(id)) }
  async write(record: AnalysisRecord, lease: ExecutionLease): Promise<void> {
    await this.writeJson(join(this.directory(record.id), "manifest.json"), analysisRecordSchema.parse(record), lease, record.status === "canceled")
  }
  readTask(id: string, taskId: string): Promise<AcceptedGenerationTask | undefined> { return readGenerationTask(this.directory(id), taskId) }
  saveTask(id: string, task: AcceptedGenerationTask, lease: ExecutionLease): Promise<void> { return saveGenerationTask(this.directory(id), task, lease) }
  async saveReference(id: string, reference: AnalysisReference, lease: ExecutionLease): Promise<void> {
    await this.writeJson(this.referencePath(id, reference.id), analysisReferenceSchema.parse(reference), lease)
  }
  async readReference(id: string, referenceId: string): Promise<AnalysisReference | undefined> {
    try {
      const value = analysisReferenceSchema.parse(await this.readJson(this.referencePath(id, referenceId)))
      if (value.id !== referenceId) throw new Error("Evidence identity mismatch.")
      return value
    } catch (error) { if (isMissingFileError(error)) return undefined; throw error }
  }
  async appendMetrics(id: string, metrics: ModelMetrics): Promise<void> {
    const path = join(this.directory(id), "metrics.jsonl")
    await appendModelCallRecord(path, metric.parse({ timestamp: new Date().toISOString(), metrics }), MAX_METRICS_BYTES)
  }
  async appendFailure(id: string, failure: ModelCallFailure): Promise<void> {
    const path = join(this.directory(id), "metrics.jsonl")
    await appendModelCallRecord(path, modelCallFailureRecordSchema.parse({ timestamp: new Date().toISOString(), failure }), MAX_METRICS_BYTES)
  }
  async readMetrics(id: string) { return (await this.readCalls(id)).metrics }
  async readFailures(id: string) { return (await this.readCalls(id)).failures }
  private async readCalls(id: string) {
    const path = join(this.directory(id), "metrics.jsonl")
    if ((await stat(path)).size > MAX_METRICS_BYTES) throw new Error("Report metrics exceeded their storage budget.")
    return parseModelCallLog(await readFile(path, "utf8"), metric)
  }
  private directory(id: string): string { return join(this.rootDir, z.uuid().parse(id)) }
  private subjectPath(subject: AnalysisSubject): string {
    const value = analysisSubjectSchema.parse(subject)
    const key = createHash("sha256").update(JSON.stringify([value.kind, value.id])).digest("hex")
    return join(this.rootDir, "subjects", `${key}.json`)
  }
  private indexSubject(record: AnalysisRecord): Promise<void> {
    const path = this.subjectPath(record.subject)
    const prior = this.indexWrites.get(path)
    const operation = (prior ? prior.catch(() => undefined) : Promise.resolve()).then(async () => {
      const previous = await this.latest(record.subject)
      if (previous && (previous.createdAt > record.createdAt || (previous.createdAt === record.createdAt && previous.id >= record.id))) return
      await mkdir(join(this.rootDir, "subjects"), { recursive: true })
      await this.writeJson(path, subjectPointer.parse({ id: record.id, subject: record.subject, createdAt: record.createdAt }))
    })
    const completed = operation.finally(() => { if (this.indexWrites.get(path) === completed) this.indexWrites.delete(path) })
    this.indexWrites.set(path, completed)
    return completed
  }
  private referencePath(id: string, referenceId: string): string {
    const key = z.string().min(1).max(240).parse(referenceId)
    return join(this.directory(id), `evidence-${createHash("sha256").update(key).digest("hex")}.json`)
  }
  private async readJson(path: string): Promise<unknown> {
    if ((await stat(path)).size > MAX_REPORT_BYTES) throw new Error("Report artifact exceeds its byte limit.")
    return JSON.parse(await readFile(path, "utf8"))
  }
  private async writeJson(path: string, value: unknown, lease?: ExecutionLease, canceled = false): Promise<void> {
    const body = JSON.stringify(value)
    if (Buffer.byteLength(body) > MAX_REPORT_BYTES) throw new Error("Report artifact exceeds its byte limit.")
    const temporary = `${path}.${crypto.randomUUID()}.tmp`
    try {
      await writeFile(temporary, body, { flag: "wx" })
      if (lease) lease.publish(temporary, path, canceled)
      else await rename(temporary, path)
    }
    finally { await rm(temporary, { force: true }) }
  }
}
