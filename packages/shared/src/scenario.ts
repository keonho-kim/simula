export type PromptLanguage = "en" | "ko"

export interface ScenarioControls {
  numCast: number
  allowAdditionalCast: boolean
  actionsPerType: number
  maxRound: number
  fastMode: boolean
  actorContextTokenBudget?: number
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

