import { ChatAnthropic } from "@langchain/anthropic"
import { ChatOpenAI } from "@langchain/openai"
import type { LLMSettings, ModelRole } from "@simula/shared"

export async function invokeRoleText(
  settings: LLMSettings,
  role: ModelRole,
  prompt: string
): Promise<string> {
  const config = settings[role]
  if (config.apiKey === "test-key") {
    return testResponse(prompt)
  }
  if (config.apiKey === "empty-test-key") {
    return ""
  }
  const model =
    config.provider === "anthropic"
      ? new ChatAnthropic({
          apiKey: config.apiKey,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        })
      : new ChatOpenAI({
          apiKey: config.apiKey,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          timeout: config.timeoutSeconds * 1000,
        })
  const response = await model.invoke(prompt)
  return contentToText(response.content)
}

function testResponse(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (lower.includes("storybuilder")) {
    const userIdea = prompt.match(/User:\s*(.+)/)?.[1]?.trim() ?? "A compact actor-driven simulation scenario."
    return [
      "# Scenario Draft",
      "",
      "## Purpose and End Condition",
      "- Start when the central pressure becomes visible.",
      "- End when a practical decision is made.",
      "",
      "## Core Situation",
      userIdea,
    ].join("\n")
  }
  if (lower.includes("thought")) {
    return "The situation requires careful staged reasoning."
  }
  if (lower.includes("target")) {
    return "The most pressured decision maker."
  }
  if (lower.includes("action")) {
    return "Coordinate a concrete next step."
  }
  if (lower.includes("intent")) {
    return "Reduce uncertainty and expose tradeoffs."
  }
  return "A concise model response."
}

function contentToText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim()
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part
        }
        if (typeof part === "object" && part && "text" in part) {
          return String(part.text)
        }
        return ""
      })
      .join("")
      .trim()
  }
  return ""
}
