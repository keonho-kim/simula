/**
 * Purpose: Persist batch identities and fence transactional updates to compact world progress records.
 * Pattern: Repository with execution ownership and atomic manifest replacement.
 * Usage: Owned by the Multiverse runtime and composed under the configured data root.
 * Related: src/shared/multiverse-schema.ts, src/backend/runtime/multiverse/jobs.ts
 */
import { readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs"
import { ExecutionOwnership, type ExecutionLease } from "../generation/execution-lease"
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { z } from "zod"
import type { MultiverseRecord, MultiverseRequest } from "@/shared/multiverse"
import { multiverseRecordSchema, multiverseRequestSchema } from "@/shared/multiverse-schema"
import { isMissingFileError } from "../file-errors"
import { WorldCommands } from "./world-commands"

const MAX_BATCH_BYTES = 256 * 1024
const MINUTE_MS = 60_000

export class BatchStore {
  readonly rootDir: string
  private readonly writes = new Map<string, Promise<MultiverseRecord>>()
  constructor(rootDir: string) { this.rootDir = resolve(rootDir) }

  create(id: string, input: MultiverseRequest, version: number): Promise<MultiverseRecord> {
    return this.serialize(id, async () => {
      const request = multiverseRequestSchema.parse(input)
      const existing = async () => {
        const previous = await this.read(id)
        if (JSON.stringify(previous.request) !== JSON.stringify(request) || previous.sourceScenarioVersion !== version) {
          throw new Error("Batch idempotency key has different input.")
        }
        return previous
      }
      try { return await existing() } catch (error) { if (!isMissingFileError(error)) throw error }
      const now = Date.now()
      const record: MultiverseRecord = { id, request, sourceScenarioVersion: version, createdAt: new Date(now).toISOString(),
        deadlineAt: new Date(now + request.maxDurationMinutes * MINUTE_MS).toISOString(), revision: 1, status: "running",
        worlds: Array.from({ length: request.worldCount }, (_, index) => ({ id: crypto.randomUUID(), index: index + 1,
          status: "pending", autoContinue: request.autoContinue, automaticStreak: 0 })),
      }
      await mkdir(this.rootDir, { recursive: true })
      const staging = join(this.rootDir, `.batch-${crypto.randomUUID()}`)
      await mkdir(staging)
      try {
        await writeFile(join(staging, "manifest.json"), this.serializeRecord(record))
        try { await rename(staging, this.directory(id)) }
        catch (error) {
          if (!error || typeof error !== "object" || !("code" in error) || !["EEXIST", "ENOTEMPTY"].includes(String(error.code))) throw error
          return existing()
        }
        return record
      } finally { await rm(staging, { recursive: true, force: true }) }
    })
  }

  async read(id: string): Promise<MultiverseRecord> {
    const path = join(this.directory(id), "manifest.json")
    if ((await stat(path)).size > MAX_BATCH_BYTES) throw new Error("Batch manifest exceeds its size limit.")
    const record = multiverseRecordSchema.parse(JSON.parse(await readFile(path, "utf8")))
    if (record.id !== id) throw new Error("Batch identity mismatch.")
    return record
  }

  execution(id: string): ExecutionOwnership { return new ExecutionOwnership(this.directory(id)) }
  commands(id: string): WorldCommands { return new WorldCommands(this.directory(id), () => this.readCurrent(id)) }

  async update(id: string, reduce: (record: MultiverseRecord) => MultiverseRecord, lease: ExecutionLease, allowCanceled = false): Promise<MultiverseRecord> {
    lease.assertScope(this.directory(id))
    const path = join(this.directory(id), "manifest.json")
    let updated: MultiverseRecord | undefined
    // Batch progress is small and bounded. Keep read/reduce/replace within one reservation
    // so independent repository instances cannot lose sibling updates.
    lease.publishRelatedArtifact(() => {
      const before = this.readCurrent(id)
      const next = { ...reduce(before), revision: before.revision + 1 }
      if (next.id !== id || JSON.stringify(next.request) !== JSON.stringify(before.request)
        || next.sourceScenarioVersion !== before.sourceScenarioVersion || next.worlds.length !== before.worlds.length
        || next.worlds.some((world, index) => world.id !== before.worlds[index]?.id)) throw new Error("Batch identity and request are immutable.")
      const body = this.serializeRecord(next)
      const temporary = `${path}.${crypto.randomUUID()}.tmp`
      writeFileSync(temporary, body, { flag: "wx" })
      try { renameSync(temporary, path) }
      catch (error) { unlinkSync(temporary); throw error }
      updated = next
      return undefined
    }, allowCanceled)
    if (!updated) throw new Error("Batch progress was not persisted.")
    return updated
  }

  private serialize(id: string, write: () => Promise<MultiverseRecord>): Promise<MultiverseRecord> {
    z.uuid().parse(id)
    const prior = this.writes.get(id)
    const operation = (prior ? prior.catch(() => undefined) : Promise.resolve()).then(write)
    const completed = operation.finally(() => { if (this.writes.get(id) === completed) this.writes.delete(id) })
    this.writes.set(id, completed)
    return completed
  }

  private serializeRecord(record: MultiverseRecord): string {
    const body = JSON.stringify(multiverseRecordSchema.parse(record))
    if (Buffer.byteLength(body) > MAX_BATCH_BYTES) throw new Error("Batch manifest exceeds its size limit.")
    return body
  }
  private readCurrent(id: string): MultiverseRecord {
    const path = join(this.directory(id), "manifest.json")
    if (statSync(path).size > MAX_BATCH_BYTES) throw new Error("Batch manifest exceeds its size limit.")
    const record = multiverseRecordSchema.parse(JSON.parse(readFileSync(path, "utf8")))
    if (record.id !== id) throw new Error("Batch identity mismatch.")
    return record
  }
  private directory(id: string): string { return join(this.rootDir, z.uuid().parse(id)) }
}
