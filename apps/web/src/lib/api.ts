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
  StoryBuilderDraftRequest,
  StoryBuilderDraftResponse,
  StoryBuilderStreamEvent,
} from "@simula/shared"

export interface RunDetailResponse {
  run: RunManifest
  state?: SimulationState
  timeline: GraphTimelineFrame[]
  events: RunEvent[]
}

export async function fetchRuns(): Promise<RunManifest[]> {
  const data = await request<{ runs: RunManifest[] }>("/api/runs")
  return data.runs
}

export async function fetchRun(runId: string): Promise<RunDetailResponse> {
  return request<RunDetailResponse>(`/api/runs/${runId}`)
}

export async function createRun(scenario: ScenarioInput): Promise<RunManifest> {
  const data = await request<{ run: RunManifest }>("/api/runs", {
    method: "POST",
    body: JSON.stringify({ scenario } satisfies CreateRunRequest),
  })
  return data.run
}

export async function draftScenario(requestBody: StoryBuilderDraftRequest): Promise<StoryBuilderDraftResponse> {
  return request<StoryBuilderDraftResponse>("/api/story-builder/draft", {
    method: "POST",
    body: JSON.stringify(requestBody),
  })
}

export async function streamDraftScenario(
  requestBody: StoryBuilderDraftRequest,
  onEvent: (event: StoryBuilderStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch("/api/story-builder/draft/stream", {
    method: "POST",
    body: JSON.stringify(requestBody),
    signal,
    headers: { "Content-Type": "application/json" },
  })
  if (!response.ok) {
    throw new Error(await response.text())
  }
  if (!response.body) {
    throw new Error("StoryBuilder stream is unavailable.")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    buffer = readStoryBuilderStreamLines(buffer, onEvent)
  }

  buffer += decoder.decode()
  readStoryBuilderStreamLines(`${buffer}\n`, onEvent)
}

export async function fetchScenarioSamples(): Promise<ScenarioSampleSummary[]> {
  const data = await request<{ samples: ScenarioSampleSummary[] }>("/api/scenarios/samples")
  return data.samples
}

export async function fetchScenarioSample(name: string): Promise<ScenarioSampleDetail> {
  const data = await request<{ sample: ScenarioSampleDetail }>(
    `/api/scenarios/samples/${encodeURIComponent(name)}`
  )
  return data.sample
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
  const data = await request<SettingsResponse>("/api/settings")
  return data.settings
}

export async function saveSettings(settings: LLMSettings): Promise<LLMSettings> {
  const data = await request<SettingsResponse>("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ settings }),
  })
  return data.settings
}

export async function fetchProviderModels(provider: ModelProvider, connection: ProviderSettings): Promise<string[]> {
  const data = await request<SettingsModelsResponse>("/api/settings/models", {
    method: "POST",
    body: JSON.stringify({ provider, connection }),
  })
  return data.models
}

export async function fetchReport(runId: string): Promise<string> {
  const response = await fetch(`/api/runs/${runId}/report`)
  if (!response.ok) {
    throw new Error(await response.text())
  }
  return response.text()
}

export async function fetchExport(runId: string, kind: ExportKindResponse["kind"]): Promise<string> {
  const response = await fetch(`/api/runs/${runId}/export?kind=${kind}`)
  if (!response.ok) {
    throw new Error(await response.text())
  }
  return response.text()
}

function readStoryBuilderStreamLines(
  buffer: string,
  onEvent: (event: StoryBuilderStreamEvent) => void
): string {
  const lines = buffer.split("\n")
  const rest = lines.pop() ?? ""
  for (const line of lines) {
    if (!line.trim()) {
      continue
    }
    const event = JSON.parse(line) as StoryBuilderStreamEvent
    onEvent(event)
    if (event.type === "error") {
      throw new Error(event.error)
    }
  }
  return rest
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
    throw new Error(body || response.statusText)
  }
  return response.json() as Promise<T>
}
