import type { ProviderSettings } from "./settings"
import type { ScenarioControls, ScenarioInput, ScenarioSampleDetail, ScenarioSampleSummary } from "./scenario"
import type { LLMSettings } from "./settings"
import type { ModelProvider } from "./model"

export interface CreateRunRequest {
  scenario: ScenarioInput
}

export interface SettingsResponse {
  settings: LLMSettings
}

export interface SettingsModelsRequest {
  provider: ModelProvider
  connection: ProviderSettings
}

export interface SettingsModelsResponse {
  models: string[]
}

export interface StoryBuilderMessage {
  role: "user" | "assistant"
  content: string
}

export interface StoryBuilderDraftRequest {
  messages: StoryBuilderMessage[]
  controls: ScenarioControls
  language?: ScenarioInput["language"]
}

export interface StoryBuilderDraftResponse {
  text: string
}

export interface ScenarioSamplesResponse {
  samples: ScenarioSampleSummary[]
}

export interface ScenarioSampleResponse {
  sample: ScenarioSampleDetail
}

export interface ExportKindResponse {
  kind: "json" | "jsonl" | "md"
  contentType: string
  body: string
}

