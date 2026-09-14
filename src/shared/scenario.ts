export type PromptLanguage = "en" | "ko"
export type PromptOutputLength = "short" | "medium" | "long"
export type ScenarioLoadLevel = "low" | "middle" | "high"

export interface ScenarioControls {
  numCast: number
  allowAdditionalCast: boolean
  actionsPerType: number
  maxRound: number
  fastMode: boolean
  outputLength?: PromptOutputLength
  loadLevel?: ScenarioLoadLevel
}

export interface ScenarioInput {
  sourceName?: string
  text: string
  controls: ScenarioControls
  language?: PromptLanguage
}

export interface ScenarioSampleSummary {
  name: string
  title: string
  controls: ScenarioControls
}

export interface ScenarioSampleDetail {
  name: string
  title: string
  text: string
  controls: ScenarioControls
}
