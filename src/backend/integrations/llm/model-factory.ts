import { ChatAnthropic } from "@langchain/anthropic"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatOpenAI } from "@langchain/openai"
import type { ModelProvider, ResolvedRoleSettings } from "@/shared"
import { isOpenAICompatibleProvider } from "@/backend/core/settings"
import type { ChatInput, StreamingChatModel } from "@/backend/integrations/llm/types"

export function createChatModel(config: ResolvedRoleSettings): StreamingChatModel {
  const unitTestModel = createUnitTestModel(config)
  if (unitTestModel) {
    return unitTestModel
  }

  if (config.provider === "anthropic") {
    return new ChatAnthropic({
      apiKey: config.apiKey,
      model: config.model,
      maxTokens: config.maxTokens,
      streamUsage: config.streamUsage ?? true,
    })
  }
  if (config.provider === "gemini") {
    return new ChatGoogleGenerativeAI({
      apiKey: config.apiKey,
      model: config.model,
      maxOutputTokens: config.maxTokens,
      topP: config.topP,
      topK: config.topK,
      safetySettings: config.safetySettings?.map((setting) => ({
        category: setting.category,
        threshold: setting.threshold,
      })) as never,
      streamUsage: config.streamUsage ?? true,
    })
  }
  return new ChatOpenAI({
    apiKey: apiKeyForOpenAICompatibleProvider(config.provider, config.apiKey),
    model: config.model,
    temperature: isOpenAICompatibleProvider(config.provider) ? config.temperature : undefined,
    maxTokens: config.maxTokens,
    timeout: config.timeoutSeconds * 1000,
    streamUsage: config.streamUsage ?? true,
    topP: config.topP,
    frequencyPenalty: config.frequencyPenalty,
    presencePenalty: config.presencePenalty,
    modelKwargs: buildOpenAIModelKwargs(config),
    configuration: {
      baseURL: isOpenAICompatibleProvider(config.provider) ? config.baseUrl : undefined,
      defaultHeaders: config.extraHeaders,
    },
  })
}

function apiKeyForOpenAICompatibleProvider(provider: ModelProvider, apiKey: string | undefined): string | undefined {
  if (!isOpenAICompatibleProvider(provider)) {
    return apiKey
  }
  return apiKey?.trim() || provider
}

function buildOpenAIModelKwargs(config: ResolvedRoleSettings): Record<string, unknown> {
  const kwargs: Record<string, unknown> = { ...(config.extraBody ?? {}) }
  if (config.seed !== undefined) {
    kwargs.seed = config.seed
  }
  if (config.reasoningEffort) {
    kwargs.reasoning_effort = config.reasoningEffort
  }
  return kwargs
}

function createUnitTestModel(config: ResolvedRoleSettings): StreamingChatModel | undefined {
  if (process.env.SIMULA_TEST_MODEL !== "1") {
    return undefined
  }
  const apiKey = config.apiKey?.trim()
  if (apiKey !== "unit-test-api-key" && apiKey !== "unit-test-empty-key") {
    return undefined
  }

  return {
    async stream(input) {
      const content = apiKey === "unit-test-empty-key" ? "" : unitTestResponse(input)
      return unitTestStream(content)
    },
  }
}

function unitTestStream(content: string): AsyncIterable<{ content: string }> {
  return {
    async *[Symbol.asyncIterator]() {
      yield { content }
    },
  }
}

function unitTestResponse(input: ChatInput): string {
  const prompt = chatInputText(input)
  const exactChoice = unitTestExactChoice(prompt)
  if (exactChoice) {
    return exactChoice
  }
  if (prompt.includes("StoryBuilder for Simula")) {
    return unitTestScenarioDraft()
  }
  if (prompt.includes("Generator roster.")) {
    return unitTestRoster(prompt)
  }
  if (prompt.includes("Planner actionCatalog.")) {
    const scope = prompt.match(/Scope: ([^\n]+)/)?.[1] ?? "public"
    const count = Number(prompt.match(/Batch size: (\d+)/)?.[1] ?? 3)
    const korean = prompt.includes("Language: Korean.")
    const names: Record<string, [string[], string[]]> = {
      public: [["근거 요청", "대안 제안", "공개 이의 제기"], ["Request evidence", "Propose an alternative", "Challenge an assumption"]],
      "semi-public": [["실무 의견 수렴", "공동 계획 조정", "그룹 중재 요청"], ["Gather team feedback", "Coordinate a joint plan", "Request group mediation"]],
      private: [["비공개 협상", "우려 확인", "개별 지원 요청"], ["Negotiate privately", "Clarify concerns", "Request individual support"]],
      solitary: [["자료 검토", "입장 재평가", "대응안 준비"], ["Review evidence", "Reconsider a position", "Prepare a response"]],
    }
    const options = names[scope]![korean ? 0 : 1]
    const used = prompt.split("Already defined labels (do not duplicate):")[1] ?? ""
    return options.filter((name) => !used.includes(`- ${name}`)).slice(0, count).map((name) => korean
      ? `${name} | 판단에 필요한 정보나 협력이 부족할 때 | 관련 정보를 얻거나 다음 행동을 준비한다`
      : `${name} | Use when information or cooperation is needed | Seek evidence or prepare the next step`).join("\n")
  }
  if (prompt.includes("Planner majorEvents")) {
    return [
      "Release Risk Review - The team must decide whether the release can proceed under visible uncertainty.",
      "Customer Escalation - A major stakeholder demands a clear owner and timeline.",
      "Executive Decision Gate - Leadership requires a bounded recommendation before launch.",
    ].join("\n")
  }
  if (prompt.includes("Generator actor card role.")) {
    return "Decision stakeholder"
  }
  if (prompt.includes("Actor message.")) {
    return "We need a bounded decision with clear ownership."
  }
  if (prompt.includes("Observer roundSummary.")) {
    return "The round moved the decision forward through concrete pressure, visible ownership, and bounded next steps."
  }
  return "The situation advances through a concrete, realistic decision pressure."
}

function chatInputText(input: ChatInput): string {
  return typeof input === "string" ? input : input.map((message) => message.content).join("\n\n")
}

function unitTestExactChoice(prompt: string): string | undefined {
  const outputs = allowedOutputs(prompt)
  if (!outputs.length) {
    return undefined
  }
  if (prompt.includes("Coordinator eventResolution.")) {
    return outputs.includes("completed") ? "completed" : outputs[0]
  }
  if (prompt.includes("Coordinator progressDecision.")) {
    return prompt.includes("Unresolved events:\n- None") && outputs.includes("complete") ? "complete" : outputs[0]
  }
  if (prompt.includes("Coordinator extensionDecision.")) {
    return outputs.includes("stop") ? "stop" : outputs[0]
  }
  return outputs[0]
}

function allowedOutputs(prompt: string): string[] {
  const marker = "Allowed outputs:"
  const markerIndex = prompt.lastIndexOf(marker)
  if (markerIndex < 0) {
    return []
  }
  const lines = prompt.slice(markerIndex + marker.length).split("\n")
  const outputs: string[] = []
  for (const line of lines) {
    const match = line.match(/^\s*-\s+([^\s(]+)(?:\s|\(|$)/)
    if (!match) {
      if (outputs.length) {
        break
      }
      continue
    }
    outputs.push(match[1] ?? "")
  }
  return outputs.filter(Boolean)
}

function unitTestRoster(prompt: string): string {
  const expectedCount = Number(prompt.match(/Return exactly one line with (\d+) entries\./)?.[1] ?? "3")
  return Array.from({ length: expectedCount }, (_, index) => {
    const label = String.fromCharCode(65 + index)
    return `Actor ${label}: Decision stakeholder ${index + 1}`
  }).join("; ")
}

function unitTestScenarioDraft(): string {
  return [
    "# Scenario Draft",
    "",
    "## Purpose and End Condition",
    "- Start when a public decision pressure becomes visible to every key actor.",
    "- End when one practical course of action is chosen and ownership is clear.",
    "",
    "## Core Situation",
    "- A city council faces a controversial infrastructure vote with incomplete public trust.",
    "- Time pressure, budget exposure, and accountability concerns shape every move.",
    "",
    "## Key Actors",
    "- Council Chair: owns the agenda and must keep the vote legitimate.",
    "- Public Works Lead: understands execution constraints and operational risk.",
    "- Budget Controller: protects fiscal exposure and demands explicit tradeoffs.",
    "- Neighborhood Representative: carries public pressure into the decision.",
    "",
    "## Channels",
    "- `public`: council meetings, press statements, published updates",
    "- `private`: direct calls, legal warnings, budget negotiations",
    "- `group`: working sessions and cross-functional review meetings",
    "",
    "## Immediate Action Units",
    "- Request a revised risk memo before the vote.",
    "- Reframe the decision around a narrower condition.",
    "- Push conditional approval with named ownership.",
    "- Change public wording to reduce visible risk.",
    "",
    "## Behavioral Realism Rules",
    "- Actors negotiate timing, responsibility, evidence, and public framing.",
    "- No actor has perfect knowledge or resolves the conflict in one move.",
  ].join("\n")
}
