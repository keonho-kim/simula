/**
 * Purpose: Retain isolated temporary run manifests, events, timelines, and model artifacts.
 * Pattern: Repository with fenced writes and atomic creation.
 * Usage: Instantiated by backend composition and called by run/world execution owners.
 * Related: src/backend/core/simulation/outputs/timeline-projector.ts, src/backend/storage/runs/run-id.ts
 */
import { RoundApprovals } from "./round-approvals"
import { RunEventLog } from "./event-log"
import { RunEventBuffer } from "./event-buffer"
import { writeRunArtifact } from "./artifact-writer"
import { renameSync } from "node:fs"
import { ExecutionOwnership, type ExecutionLease } from "@/backend/storage/generation/execution-lease"
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import type {
  ExportKindResponse,
  GraphTimelineFrame,
  RunEvent,
  RunManifest,
  ScenarioInput,
  SimulationState,
} from "@/shared"
import { TimelineProjector } from "@/backend/core/simulation/outputs/timeline-projector"
import { assertRunPathSegment, buildRunId, buildWorldRunId } from "@/backend/storage/runs/run-id"
import { runManifestSchema } from "@/shared/run-schema"
import { MODEL_ACCOUNTING_VERSION } from "@/shared/model-failure"
import { MAX_RUN_EVENT_BYTES, parseRunCursor } from "@/shared/run-stream"
import { normalizeStoredScenario } from "@/backend/storage/runs/scenario"
import { cloneTimeline, createsTimelineFrame } from "@/backend/storage/runs/timeline"
import { readRunCallRecords } from "@/backend/storage/runs/metrics"
import type { RunStoreOptions } from "@/backend/storage/runs/types"

export class RunStore {
  readonly rootDir: string
  private readonly timelineCache = new Map<string, GraphTimelineFrame[]>()
  private readonly timelineProjectors = new Map<string, TimelineProjector>()
  private readonly prunedEventCounts = new Map<string, number>()
  private readonly eventBuffers = new Map<string, RunEventBuffer>()

  constructor(options: RunStoreOptions) {
    this.rootDir = resolve(options.rootDir)
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true })
  }

  async createRun(scenario: ScenarioInput, options: { id?: string; initialEvents?: RunEvent[]; batchId?: string; worldLease?: ExecutionLease } = {}): Promise<RunManifest> {
    const normalizedScenario = normalizeStoredScenario(scenario)
    await this.ensureRoot()
    const id = options.id ?? buildRunId(normalizedScenario.sourceName)
    const eventBuffer = new RunEventBuffer(id)
    const projector = new TimelineProjector()
    const initialTimeline: GraphTimelineFrame[] = []
    for (const event of options.initialEvents ?? []) {
      eventBuffer.append(event)
      const frame = projector.accept(event)
      if (frame) initialTimeline.push(frame)
    }
    if (options.worldLease && (!normalizedScenario.world || id !== buildWorldRunId(normalizedScenario.world.id))) {
      throw new Error("Owned world handoff requires its deterministic world run ID.")
    }
    if (options.initialEvents?.some(event => event.runId !== id)) throw new Error("Initial events must belong to this run.")
    const destination = this.runDir(id)
    const manifest: RunManifest = {
      id,
      status: "created",
      usageAccountingVersion: MODEL_ACCOUNTING_VERSION,
      createdAt: new Date().toISOString(),
      batchId: options.batchId,
      scenarioName: normalizedScenario.sourceName,
      artifactPaths: this.artifactPaths(id),
    }
    const staging = join(this.rootDir, `.run-create-${crypto.randomUUID()}`)
    await mkdir(staging)
    try {
      await Promise.all([
        writeFile(join(staging, "manifest.json"), JSON.stringify(manifest)),
        writeFile(join(staging, "scenario.json"), JSON.stringify(normalizedScenario)),
        writeFile(join(staging, "graph.timeline.json"), JSON.stringify(initialTimeline)),
        writeFile(join(staging, "events.jsonl"), options.initialEvents?.map(event => `${JSON.stringify(event)}\n`).join("") ?? ""),
      ])
      try {
        if (options.worldLease) options.worldLease.publishRelatedArtifact(() => { renameSync(staging, destination); return undefined })
        else await rename(staging, destination)
      }
      catch (error) {
        if (!options.id || !error || typeof error !== "object" || !("code" in error) || !["EEXIST", "ENOTEMPTY"].includes(String(error.code))) throw error
        const existing = await this.readScenario(id)
        if (JSON.stringify(existing) !== JSON.stringify(normalizedScenario)) throw new Error("Run ID already belongs to different scenario input.", { cause: error })
        const previous = await this.readManifest(id)
        if (previous.batchId !== options.batchId) throw new Error("Run ID already belongs to a different batch owner.", { cause: error })
        if (previous.status === "created" || previous.status === "running") await this.loadProjector(id)
        return previous
      }
      this.timelineCache.set(id, initialTimeline)
      this.timelineProjectors.set(id, projector)
      this.eventBuffers.set(id, eventBuffer)
      return manifest
    } finally { await rm(staging, { recursive: true, force: true }) }
  }

  async listRuns(): Promise<RunManifest[]> {
    await this.ensureRoot()
    const entries = await readdir(this.rootDir, { withFileTypes: true })
    const manifests = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map(async (entry) => {
          try {
            return await this.readManifest(entry.name)
          } catch {
            return undefined
          }
        })
    )
    return manifests
      .filter((manifest): manifest is RunManifest => Boolean(manifest))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async readManifest(runId: string): Promise<RunManifest> {
    const stored: unknown = JSON.parse(await readFile(this.path(runId, "manifest.json"), "utf8"))
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) throw new Error("Invalid run manifest.")
    // Artifact locations are derived from the current owner, never trusted from a stored machine path.
    const manifest = runManifestSchema.parse({ ...stored, artifactPaths: this.artifactPaths(runId) })
    if (manifest.id !== runId) throw new Error("Run manifest identity does not match its storage owner.")
    return manifest
  }

  execution(runId: string): ExecutionOwnership { return new ExecutionOwnership(this.runDir(runId)) }
  roundApprovals(runId: string): RoundApprovals { return new RoundApprovals(this.runDir(runId)) }
  async openEventLog(runId: string, cursor?: string): Promise<Pick<RunEventLog, "next" | "close">> {
    const buffer = this.eventBuffers.get(runId)
    if (buffer) return buffer.open(cursor)
    return RunEventLog.open(this.path(runId, "events.jsonl"), runId, cursor)
  }

  confirmStreamThrough(runId: string, cursor: string): boolean {
    const buffer = this.eventBuffers.get(runId)
    return buffer?.prune(parseRunCursor(cursor, runId)) ?? false
  }

  async writeManifest(manifest: RunManifest, lease: ExecutionLease): Promise<void> {
    await this.writeJson(manifest.id, "manifest.json", manifest, lease, manifest.status === "canceled")
  }

  async readScenario(runId: string): Promise<ScenarioInput> {
    return normalizeStoredScenario(JSON.parse(await readFile(this.path(runId, "scenario.json"), "utf8")) as ScenarioInput)
  }

  async readState(runId: string): Promise<SimulationState | undefined> {
    try {
      return JSON.parse(await readFile(this.path(runId, "state.json"), "utf8")) as SimulationState
    } catch {
      return undefined
    }
  }

  async writeState(state: SimulationState, lease: ExecutionLease): Promise<void> {
    const allowCanceled = state.stopReason === "canceled" || state.reportCommentary?.status === "failed"
    await this.flushTimeline(state.runId, lease, allowCanceled)
    await this.writeJson(state.runId, "state.json", state, lease, allowCanceled)
    await writeRunArtifact(this.path(state.runId, "report.md"), state.reportMarkdown, lease, allowCanceled)
  }

  async appendEvent(event: RunEvent, lease: ExecutionLease): Promise<GraphTimelineFrame | undefined> {
    const allowCanceled = event.type === "run.canceled" || event.type === "model.metrics" || event.type === "model.attempt.failed" || event.type === "log"
    const body = JSON.stringify(event)
    if (Buffer.byteLength(body) > MAX_RUN_EVENT_BYTES) throw new Error("Run event exceeds the stream size limit.")
    const projector = event.type === "graph.delta" ? undefined : this.timelineProjectors.get(event.runId)
      ?? (createsTimelineFrame(event) ? await this.loadProjector(event.runId) : undefined)
    lease.append(this.path(event.runId, "events.jsonl"), `${body}\n`, allowCanceled)
    this.eventBuffers.get(event.runId)?.append(event)
    const frame = projector?.accept(event)
    if (event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled") {
      await this.flushTimeline(event.runId, lease, allowCanceled)
    }
    if (event.type === "graph.delta") {
      return event.frame
    }
    if (!frame) return undefined
    const timeline = await this.loadTimeline(event.runId)
    timeline.push(frame)
    return frame
  }

  async readEvents(runId: string): Promise<RunEvent[]> {
    const body = await readFile(this.path(runId, "events.jsonl"), "utf8")
    return body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RunEvent)
  }

  async pruneConfirmedEvents(runId: string, confirmedCount: number): Promise<boolean> {
    const events = await this.readEvents(runId)
    const total = (this.prunedEventCounts.get(runId) ?? 0) + events.length
    if (total !== confirmedCount) return false
    if (events.length) await writeFile(this.path(runId, "events.jsonl"), "")
    const buffer = this.eventBuffers.get(runId)
    if (buffer) buffer.prune(buffer.latestOffset)
    this.prunedEventCounts.set(runId, confirmedCount)
    return true
  }

  readModelCallRecords(runId: string) {
    return readRunCallRecords(this.path(runId, "events.jsonl"), runId)
  }

  async readTimeline(runId: string): Promise<GraphTimelineFrame[]> {
    const cached = this.timelineCache.get(runId)
    if (cached) {
      return cloneTimeline(cached)
    }
    try {
      return JSON.parse(await readFile(this.path(runId, "graph.timeline.json"), "utf8")) as GraphTimelineFrame[]
    } catch {
      return []
    }
  }

  private async loadTimeline(runId: string): Promise<GraphTimelineFrame[]> {
    const cached = this.timelineCache.get(runId)
    if (cached) {
      return cached
    }
    const timeline = await this.readTimeline(runId)
    this.timelineCache.set(runId, timeline)
    return timeline
  }

  private async loadProjector(runId: string): Promise<TimelineProjector> {
    const existing = this.timelineProjectors.get(runId)
    if (existing) return existing
    const projector = new TimelineProjector()
    let frameCount = 0
    for (const event of await this.readEvents(runId)) {
      if (projector.accept(event)) frameCount += 1
    }
    const timeline = await this.loadTimeline(runId)
    if (timeline.length !== frameCount) throw new Error("Cannot resume a timeline without its complete event history.")
    this.timelineProjectors.set(runId, projector)
    return projector
  }

  private async flushTimeline(runId: string, lease: ExecutionLease, allowCanceled = false): Promise<void> {
    const timeline = this.timelineCache.get(runId)
    if (timeline) {
      await this.writeJson(runId, "graph.timeline.json", timeline, lease, allowCanceled)
    }
  }

  async readReport(runId: string): Promise<string> {
    return readFile(this.path(runId, "report.md"), "utf8")
  }

  async export(runId: string, kind: "json" | "jsonl" | "md"): Promise<ExportKindResponse> {
    if (kind === "json") {
      return {
        kind,
        contentType: "application/json",
        body: await readFile(this.path(runId, "state.json"), "utf8"),
      }
    }
    if (kind === "jsonl") {
      return {
        kind,
        contentType: "application/x-ndjson",
        body: await readFile(this.path(runId, "events.jsonl"), "utf8"),
      }
    }
    return {
      kind,
      contentType: "text/markdown",
      body: await readFile(this.path(runId, "report.md"), "utf8"),
    }
  }

  artifactPaths(runId: string) {
    return {
      manifest: `${runId}/manifest.json`,
      events: `${runId}/events.jsonl`,
      state: `${runId}/state.json`,
      report: `${runId}/report.md`,
      timeline: `${runId}/graph.timeline.json`,
    }
  }

  runDir(runId: string): string {
    assertRunPathSegment(runId)
    return join(this.rootDir, runId)
  }

  releaseTimeline(runId: string): void {
    this.timelineCache.delete(runId)
    this.timelineProjectors.delete(runId)
  }

  forgetRun(runId: string): void {
    this.timelineCache.delete(runId)
    this.timelineProjectors.delete(runId)
    this.prunedEventCounts.delete(runId)
    this.eventBuffers.delete(runId)
  }

  path(runId: string, fileName: string): string {
    assertRunPathSegment(fileName)
    return join(this.runDir(runId), fileName)
  }

  private async writeJson(runId: string, fileName: string, value: unknown, lease: ExecutionLease, allowCanceled = false): Promise<void> {
    await writeRunArtifact(this.path(runId, fileName), `${JSON.stringify(value, null, 2)}\n`, lease, allowCanceled)
  }
}
