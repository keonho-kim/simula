import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type {
  ExportKindResponse,
  GraphTimelineFrame,
  RunEvent,
  RunManifest,
  ScenarioInput,
  SimulationState,
} from "@simula/shared"
import { buildTimelineFrame } from "../simulation/timeline"
import { buildRunId } from "./run-id"
import { normalizeStoredScenario } from "./scenario"
import { cloneTimeline, createsTimelineFrame } from "./timeline"
import type { RunStoreOptions } from "./types"

export class RunStore {
  readonly rootDir: string
  private readonly timelineCache = new Map<string, GraphTimelineFrame[]>()

  constructor(options: RunStoreOptions) {
    this.rootDir = options.rootDir
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true })
  }

  async createRun(scenario: ScenarioInput): Promise<RunManifest> {
    const normalizedScenario = normalizeStoredScenario(scenario)
    await this.ensureRoot()
    const id = buildRunId(normalizedScenario.sourceName)
    const manifest: RunManifest = {
      id,
      status: "created",
      createdAt: new Date().toISOString(),
      scenarioName: normalizedScenario.sourceName,
      artifactPaths: this.artifactPaths(id),
    }
    await mkdir(this.runDir(id), { recursive: true })
    await this.writeManifest(manifest)
    await this.writeJson(id, "scenario.json", normalizedScenario)
    await this.writeJson(id, "graph.timeline.json", [])
    this.timelineCache.set(id, [])
    await writeFile(this.path(id, "events.jsonl"), "", "utf8")
    return manifest
  }

  async listRuns(): Promise<RunManifest[]> {
    await this.ensureRoot()
    const entries = await readdir(this.rootDir, { withFileTypes: true })
    const manifests = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
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
    return JSON.parse(await readFile(this.path(runId, "manifest.json"), "utf8")) as RunManifest
  }

  async writeManifest(manifest: RunManifest): Promise<void> {
    await this.writeJson(manifest.id, "manifest.json", manifest)
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

  async writeState(state: SimulationState): Promise<void> {
    await this.flushTimeline(state.runId)
    await this.writeJson(state.runId, "state.json", state)
    await writeFile(this.path(state.runId, "report.md"), state.reportMarkdown, "utf8")
  }

  async appendEvent(event: RunEvent): Promise<GraphTimelineFrame | undefined> {
    await writeFile(this.path(event.runId, "events.jsonl"), `${JSON.stringify(event)}\n`, {
      encoding: "utf8",
      flag: "a",
    })
    if (event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled") {
      await this.flushTimeline(event.runId)
    }
    if (event.type === "graph.delta") {
      return event.frame
    }
    if (!createsTimelineFrame(event)) {
      return undefined
    }

    const previousTimeline = await this.loadTimeline(event.runId)
    const frame = buildTimelineFrame(previousTimeline.length, event, previousTimeline.at(-1))
    const nextTimeline = [...previousTimeline, frame]
    this.timelineCache.set(event.runId, nextTimeline)
    if (event.type === "actors.ready" || event.type === "round.completed") {
      await this.flushTimeline(event.runId)
    }
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

  private async flushTimeline(runId: string): Promise<void> {
    const timeline = this.timelineCache.get(runId)
    if (timeline) {
      await this.writeJson(runId, "graph.timeline.json", timeline)
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
      manifest: `runs/${runId}/manifest.json`,
      events: `runs/${runId}/events.jsonl`,
      state: `runs/${runId}/state.json`,
      report: `runs/${runId}/report.md`,
      timeline: `runs/${runId}/graph.timeline.json`,
    }
  }

  runDir(runId: string): string {
    return join(this.rootDir, runId)
  }

  path(runId: string, fileName: string): string {
    return join(this.runDir(runId), fileName)
  }

  private async writeJson(runId: string, fileName: string, value: unknown): Promise<void> {
    await mkdir(this.runDir(runId), { recursive: true })
    await writeFile(this.path(runId, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8")
  }
}
