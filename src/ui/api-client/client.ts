/**
 * Purpose: Transport run, settings, and sample API operations.
 * Pattern: Browser HTTP adapter.
 * Usage: Imported by application lifecycle hooks and pages.
 * Related: src/shared/api.ts, src/ui/browser-storage/database/runs/read-detail.ts
 */
import { shareTimelineFrames } from "@/ui/models/graph/timeline-sharing"
import { listBrowserRuns } from "@/ui/browser-storage/database/runs/list"
import { markRunInterrupted } from "@/ui/browser-storage/database/runs/mark-interrupted"
import { readBrowserRun } from "@/ui/browser-storage/database/runs/read-detail"
import { readRunReport } from "@/ui/browser-storage/database/runs/read-report"
import { saveRunDetail } from "@/ui/browser-storage/database/runs/save-detail"
import { saveRunManifest } from "@/ui/browser-storage/database/runs/save-manifest"
import { saveRunReport } from "@/ui/browser-storage/database/runs/save-report"
import { readLocalSettings } from "@/ui/browser-storage/database/settings/read"
import { saveOrdinarySettings } from "@/ui/browser-storage/database/settings/save"
import { restoreProviderSecrets, separateProviderSecrets } from "@/ui/browser-storage/database/settings/secrets"
import { readUnlockedSecrets, updateCredentialVault } from "@/ui/browser-storage/database/credential-vault"
import { listSavedSamples } from "@/ui/browser-storage/database/samples/list"
import { markSampleSeedCurrent } from "@/ui/browser-storage/database/samples/mark-seed-current"
import { readSample } from "@/ui/browser-storage/database/samples/read"
import { sampleSeedIsCurrent } from "@/ui/browser-storage/database/samples/seed-is-current"
import { saveSample } from "@/ui/browser-storage/database/samples/save"
import { saveUserScenario } from "@/ui/browser-storage/database/scenarios/save"
import type {
  CreateRunRequest,
  ExportKindResponse,
  LLMSettings,
  ModelProvider,
  ProviderSettings,
  RunManifest,
  RunEvent,
  ScenarioSampleDetail,
  ScenarioSampleSummary,
  ScenarioInput,
  SettingsResponse,
  SettingsModelsResponse,
  SimulationState,
  GraphTimelineFrame,
} from "@/shared"

export interface RunDetailResponse {
  run: RunManifest
  state?: SimulationState
  timeline: GraphTimelineFrame[]
  events: RunEvent[]
}

export async function fetchRuns(): Promise<RunManifest[]> {
  const local = await listBrowserRuns()
  if (local.some(run => run.status === "created" || run.status === "running")) {
    try {
      const active = await request<{ runs: RunManifest[] }>("/api/runs")
      const liveIds = new Set(active.runs.map(run => run.id))
      await Promise.all(local.filter(run => ["created", "running"].includes(run.status) && !liveIds.has(run.id))
        .map(run => markRunInterrupted(run.id)))
      return listBrowserRuns()
    } catch { /* A temporary network loss does not prove interruption. */ }
  }
  return local
}

export async function fetchRun(runId: string): Promise<RunDetailResponse> {
  let detail: RunDetailResponse
  try { detail = await request<RunDetailResponse>(`/api/runs/${runId}`) }
  catch (error) {
    const local = await readBrowserRun(runId)
    if (local) {
      if (error instanceof HttpRequestError && error.status === 404) {
        const run = await markRunInterrupted(runId)
        return run ? { ...local, run } : local
      }
      return local
    }
    throw error
  }
  const timeline = shareTimelineFrames(detail.timeline)
  const frames = new Map(timeline.map((frame) => [frame.index, frame]))
  const local = await readBrowserRun(runId)
  const events = local?.events.length ? mergeRunEvents(local.events, detail.events) : detail.events
  const result = { ...detail, timeline, events: events.map((event) => event.type === "graph.delta" && frames.has(event.frame.index)
    ? { ...event, frame: frames.get(event.frame.index)! } : event) }
  await saveRunDetail(result)
  if (result.run.status === "completed") await fetchReport(runId).catch(() => undefined)
  if (["completed", "failed", "canceled"].includes(result.run.status)) void acknowledgeCompleteRun(runId, result.events.length)
  return result
}

function mergeRunEvents(saved: RunEvent[], incoming: RunEvent[]): RunEvent[] {
  const seen = new Set(saved.map(event => JSON.stringify(event)))
  const merged = [...saved]
  for (const event of incoming) {
    const key = JSON.stringify(event)
    if (!seen.has(key)) { seen.add(key); merged.push(event) }
  }
  return merged
}

async function acknowledgeCompleteRun(runId: string, eventCount: number): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/ack`, { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventCount }) })
      if (response.ok && response.status !== 202) return
      if (response.status !== 202) return
    } catch { return }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}

export async function createRun(scenario: ScenarioInput): Promise<RunManifest> {
  const executionId = crypto.randomUUID()
  const data = await request<{ run: RunManifest }>("/api/runs", {
    method: "POST",
    body: JSON.stringify({ scenario, executionId } satisfies CreateRunRequest),
  })
  if (data.run.id !== executionId) throw new Error("The server returned a different execution identity.")
  await saveRunManifest(data.run)
  await saveUserScenario(scenario)
  return data.run
}

export async function fetchScenarioSamples(): Promise<ScenarioSampleSummary[]> {
  await seedBundledSamples()
  const saved = await listSavedSamples()
  if (saved.length) return saved
  const data = await request<{ samples: ScenarioSampleSummary[] }>("/api/scenarios/samples")
  return data.samples
}

export async function seedBundledSamples(): Promise<void> {
  if (await sampleSeedIsCurrent()) return
  const data = await request<{ samples: ScenarioSampleSummary[] }>("/api/scenarios/samples")
  await Promise.all(data.samples.map(async sample => {
    const detail = await request<{ sample: ScenarioSampleDetail }>(`/api/scenarios/samples/${encodeURIComponent(sample.name)}`)
    await saveSample(detail.sample)
  }))
  await markSampleSeedCurrent()
}

export async function fetchScenarioSample(name: string): Promise<ScenarioSampleDetail> {
  const saved = await readSample(name)
  if (saved) return saved
  try {
    const data = await request<{ sample: ScenarioSampleDetail }>(`/api/scenarios/samples/${encodeURIComponent(name)}`)
    await saveSample(data.sample)
    return data.sample
  } catch (error) { return await readSample(name) ?? Promise.reject(error) }
}

export async function startRun(runId: string): Promise<void> {
  await request(`/api/runs/${runId}/start`, { method: "POST" })
}

export async function continueRun(runId: string, roundIndex: number): Promise<void> {
  await request(`/api/runs/${runId}/continue`, {
    method: "POST",
    body: JSON.stringify({ roundIndex }),
  })
}

export async function cancelRun(runId: string): Promise<void> {
  await request(`/api/runs/${runId}/cancel`, { method: "POST" })
}

export async function fetchSettings(): Promise<LLMSettings> {
  const local = await readLocalSettings()
  if (local) return restoreProviderSecrets(local, readUnlockedSecrets() ?? {})
  const defaults = await request<SettingsResponse>("/api/settings/defaults", { signal: AbortSignal.timeout(10_000) })
  return defaults.settings
}

export async function saveSettings(settings: LLMSettings): Promise<LLMSettings> {
  const { secrets } = separateProviderSecrets(settings)
  await updateCredentialVault(secrets)
  await saveOrdinarySettings(settings)
  await syncActiveSettings()
  return settings
}

export async function syncActiveSettings(): Promise<void> {
  const ordinary = await readLocalSettings()
  if (!ordinary) return
  const secrets = readUnlockedSecrets()
  if (!secrets) throw new Error("Unlock provider credentials before starting model work.")
  const settings = restoreProviderSecrets(ordinary, secrets)
  await request<SettingsResponse>("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ settings }),
  })
}

export async function clearActiveSettings(): Promise<void> {
  const ordinary = await readLocalSettings()
  if (!ordinary) return
  await request<SettingsResponse>("/api/settings", { method: "PUT", body: JSON.stringify({ settings: ordinary }) })
}

export async function fetchProviderModels(provider: ModelProvider, connection: ProviderSettings): Promise<string[]> {
  const data = await request<SettingsModelsResponse>("/api/settings/models", {
    method: "POST",
    body: JSON.stringify({ provider, connection }),
  })
  return data.models
}

export async function fetchReport(runId: string): Promise<string> {
  try {
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/report`)
    if (!response.ok) throw new Error(await response.text())
    const markdown = await response.text()
    await saveRunReport(runId, markdown)
    return markdown
  } catch (error) { return await readRunReport(runId) ?? Promise.reject(error) }
}

export async function fetchExport(runId: string, kind: ExportKindResponse["kind"]): Promise<string> {
  const local = await readBrowserRun(runId)
  if (kind === "json" && local?.state) return JSON.stringify(local.state)
  if (kind === "jsonl" && local?.events.length) return local.events.map(event => JSON.stringify(event)).join("\n")
  if (kind === "md") { const report = await readRunReport(runId); if (report !== undefined) return report }
  try {
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/export?kind=${kind}`)
    if (!response.ok) throw new Error(await response.text())
    const content = await response.text()
    if (kind === "md") await saveRunReport(runId, content)
    return content
  } catch (error) {
    const detail = await readBrowserRun(runId)
    if (kind === "json" && detail?.state) return JSON.stringify(detail.state)
    if (kind === "jsonl" && detail) return detail.events.map(event => JSON.stringify(event)).join("\n")
    if (kind === "md") { const report = await readRunReport(runId); if (report !== undefined) return report }
    throw error
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new HttpRequestError(body || response.statusText, response.status)
  }
  return response.json() as Promise<T>
}

class HttpRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
