/**
 * Purpose: Persist shared scenario builds, accepted tasks, and recorded model calls.
 * Pattern: Repository.
 * Usage: Owned by scenario-builder runtime; artifacts remain under the configured data root.
 * Related: src/backend/core/scenario-builder/contracts.ts, src/backend/runtime/scenario-builder/jobs.ts
 */
import { ExecutionOwnership, type ExecutionLease } from "../generation/execution-lease"
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { z } from "zod"
import type { BuilderRequest, ScenarioBuildRecord } from "@/shared/scenario-builder"
import type { ModelMetrics } from "@/shared/run"
import { storyBuilderMetricCallSchema } from "@/shared/generation-metrics-schema"
import { MODEL_ACCOUNTING_VERSION, modelCallFailureRecordSchema, type ModelCallFailure } from "@/shared/model-failure"
import type { AcceptedGenerationTask } from "@/backend/core/generation/tasks"
import { buildRecordSchema } from "@/shared/scenario-builder-schema"
import { parseBuilderRequest } from "@/backend/core/scenario-builder/contracts"
import { readGenerationTask, saveGenerationTask } from "@/backend/storage/generation/task-artifacts"
import { isMissingFileError } from "@/backend/storage/file-errors"
import { appendModelCallRecord, parseModelCallLog } from "@/backend/storage/generation/model-call-log"

const BUILD_ARTIFACT_MAX_BYTES = 256 * 1024
const BUILD_METRICS_MAX_BYTES = 512 * 1024

export class ScenarioBuildStore {
  readonly rootDir: string
  constructor(rootDir: string) { this.rootDir = resolve(rootDir) }

  async create(id: string, request: BuilderRequest): Promise<ScenarioBuildRecord> {
    const directory = this.directory(id)
    await mkdir(this.rootDir, { recursive: true })
    await mkdir(directory)
    const record: ScenarioBuildRecord = { id, request: parseBuilderRequest(request), usageAccountingVersion: MODEL_ACCOUNTING_VERSION,
      status: "running", createdAt: new Date().toISOString() }
    await writeFile(join(directory, "metrics.jsonl"), "", { flag: "wx" })
    await this.writeJson(join(directory, "manifest.json"), record)
    return record
  }

  async read(id: string): Promise<ScenarioBuildRecord> {
    const record = buildRecordSchema.parse(await this.readJson(join(this.directory(id), "manifest.json")))
    if (record.id !== id) throw new Error("Scenario build identity mismatch.")
    return record
  }

  execution(id: string): ExecutionOwnership { return new ExecutionOwnership(this.directory(id)) }

  async write(record: ScenarioBuildRecord, lease: ExecutionLease): Promise<void> {
    await this.writeJson(join(this.directory(record.id), "manifest.json"), buildRecordSchema.parse(record), lease, record.status === "canceled")
  }

  async readTask(buildId: string, taskId: string): Promise<AcceptedGenerationTask | undefined> {
    return readGenerationTask(this.directory(buildId), taskId)
  }

  async saveTask(buildId: string, task: AcceptedGenerationTask, lease: ExecutionLease): Promise<void> {
    await saveGenerationTask(this.directory(buildId), task, lease)
  }

  async appendMetrics(id: string, metrics: ModelMetrics): Promise<void> {
    const path = join(this.directory(id), "metrics.jsonl")
    await appendModelCallRecord(path, storyBuilderMetricCallSchema.parse({ timestamp: new Date().toISOString(), metrics }), BUILD_METRICS_MAX_BYTES)
  }

  async appendFailure(id: string, failure: ModelCallFailure): Promise<void> {
    const path = join(this.directory(id), "metrics.jsonl")
    await appendModelCallRecord(path, modelCallFailureRecordSchema.parse({ timestamp: new Date().toISOString(), failure }), BUILD_METRICS_MAX_BYTES)
  }

  async readMetrics(id: string) { return (await this.readCalls(id))?.metrics }
  async readFailures(id: string) { return (await this.readCalls(id))?.failures }

  private async readCalls(id: string) {
    const path = join(this.directory(id), "metrics.jsonl")
    let body: string
    try {
      if ((await stat(path)).size > BUILD_METRICS_MAX_BYTES) throw new Error("Shared scenario metrics exceeded their storage budget.")
      body = await readFile(path, "utf8")
    } catch (error) { if (isMissingFileError(error)) return undefined; throw error }
    return parseModelCallLog(body, storyBuilderMetricCallSchema)
  }

  private directory(id: string): string { return join(this.rootDir, z.uuid().parse(id)) }

  private async readJson(path: string): Promise<unknown> {
    if ((await stat(path)).size > BUILD_ARTIFACT_MAX_BYTES) throw new Error("Scenario artifact exceeds its size limit.")
    return JSON.parse(await readFile(path, "utf8"))
  }

  private async writeJson(path: string, value: unknown, lease?: ExecutionLease, canceled = false): Promise<void> {
    const text = JSON.stringify(value)
    if (Buffer.byteLength(text) > BUILD_ARTIFACT_MAX_BYTES) throw new Error("Scenario artifact exceeds its size limit.")
    const temporary = `${path}.${crypto.randomUUID()}.tmp`
    try {
      await writeFile(temporary, text, { flag: "wx" })
      if (lease) lease.publish(temporary, path, canceled)
      else await rename(temporary, path)
    } finally { await rm(temporary, { force: true }) }
  }
}
