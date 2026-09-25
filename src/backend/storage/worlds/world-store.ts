/**
 * Purpose: Persist world preparation, accepted units, and model-call usage independently.
 * Pattern: Repository with fenced artifact publication.
 * Usage: Called by the world-preparation runtime and its API.
 * Related: src/shared/world-preparation-schema.ts, src/backend/storage/generation/task-artifacts.ts
 */
import { ExecutionOwnership, type ExecutionLease } from "../generation/execution-lease"
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { z } from "zod"
import type { ModelMetrics } from "@/shared/run"
import { storyBuilderMetricCallSchema } from "@/shared/generation-metrics-schema"
import { MODEL_ACCOUNTING_VERSION, modelCallFailureRecordSchema, type ModelCallFailure } from "@/shared/model-failure"
import type { WorldPreparationRecord, WorldPreparationRequest } from "@/shared/world-preparation"
import { worldPreparationRecordSchema, worldPreparationRequestSchema } from "@/shared/world-preparation-schema"
import type { AcceptedGenerationTask } from "@/backend/core/generation/tasks"
import { readGenerationTask, saveGenerationTask } from "@/backend/storage/generation/task-artifacts"
import { appendModelCallRecord, parseModelCallLog } from "@/backend/storage/generation/model-call-log"

const MAX_WORLD_ARTIFACT_BYTES = 256 * 1024
const MAX_WORLD_METRICS_BYTES = 512 * 1024

export class WorldStore {
  readonly rootDir: string
  constructor(rootDir: string) { this.rootDir = resolve(rootDir) }

  async create(id: string, input: WorldPreparationRequest, version: number, batchId?: string): Promise<WorldPreparationRecord> {
    const request = worldPreparationRequestSchema.parse(input)
    const destination = this.directory(id)
    await mkdir(this.rootDir, { recursive: true })
    const staging = join(this.rootDir, `.world-${crypto.randomUUID()}`)
    await mkdir(staging)
    const record: WorldPreparationRecord = { id, request, sourceScenarioVersion: version, batchId, createdAt: new Date().toISOString(),
      usageAccountingVersion: MODEL_ACCOUNTING_VERSION, status: "preparing" }
    try {
      await Promise.all([writeFile(join(staging, "metrics.jsonl"), ""),
        writeFile(join(staging, "manifest.json"), JSON.stringify(worldPreparationRecordSchema.parse(record)))])
      try { await rename(staging, destination) }
      catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || !["EEXIST", "ENOTEMPTY"].includes(String(error.code))) throw error
        const previous = await this.read(id)
        if (previous.batchId !== batchId || previous.sourceScenarioVersion !== version || JSON.stringify(previous.request) !== JSON.stringify(request)) {
          throw new Error("World identity already has different input or batch ownership.", { cause: error })
        }
        return previous
      }
      return record
    } finally { await rm(staging, { recursive: true, force: true }) }
  }

  async read(id: string): Promise<WorldPreparationRecord> {
    const path = join(this.directory(id), "manifest.json")
    if ((await stat(path)).size > MAX_WORLD_ARTIFACT_BYTES) throw new Error("World artifact exceeds its size limit.")
    const record = worldPreparationRecordSchema.parse(JSON.parse(await readFile(path, "utf8")))
    if (record.id !== id) throw new Error("World identity mismatch.")
    return record
  }

  execution(id: string): ExecutionOwnership { return new ExecutionOwnership(this.directory(id)) }

  async write(record: WorldPreparationRecord, lease: ExecutionLease): Promise<void> {
    const path = join(this.directory(record.id), "manifest.json")
    const temporary = `${path}.${crypto.randomUUID()}.tmp`
    const body = JSON.stringify(worldPreparationRecordSchema.parse(record))
    if (Buffer.byteLength(body) > MAX_WORLD_ARTIFACT_BYTES) throw new Error("World artifact exceeds its size limit.")
    try {
      await writeFile(temporary, body, { flag: "wx" })
      lease.publish(temporary, path, record.status === "canceled")
    } finally { await rm(temporary, { force: true }) }
  }

  readTask(id: string, taskId: string): Promise<AcceptedGenerationTask | undefined> { return readGenerationTask(this.directory(id), taskId) }
  saveTask(id: string, task: AcceptedGenerationTask, lease: ExecutionLease): Promise<void> { return saveGenerationTask(this.directory(id), task, lease) }

  async appendMetrics(id: string, metrics: ModelMetrics): Promise<void> {
    const path = join(this.directory(id), "metrics.jsonl")
    const value = storyBuilderMetricCallSchema.parse({ timestamp: new Date().toISOString(), metrics })
    await appendModelCallRecord(path, value, MAX_WORLD_METRICS_BYTES)
  }

  async appendFailure(id: string, failure: ModelCallFailure): Promise<void> {
    const path = join(this.directory(id), "metrics.jsonl")
    await appendModelCallRecord(path, modelCallFailureRecordSchema.parse({ timestamp: new Date().toISOString(), failure }), MAX_WORLD_METRICS_BYTES)
  }

  async readMetrics(id: string) { return (await this.readCalls(id)).metrics }
  async readFailures(id: string) { return (await this.readCalls(id)).failures }

  private async readCalls(id: string) {
    const path = join(this.directory(id), "metrics.jsonl")
    if ((await stat(path)).size > MAX_WORLD_METRICS_BYTES) throw new Error("World preparation usage history exceeded its limit.")
    return parseModelCallLog(await readFile(path, "utf8"), storyBuilderMetricCallSchema)
  }

  private directory(id: string): string { return join(this.rootDir, z.uuid().parse(id)) }
}
