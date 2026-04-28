import type { ModelRole, RoleTraceStep, RunEvent } from "@simula/shared"
import { invokeRoleTextWithMetrics } from "../../../llm"
import { withPromptLanguageGuide } from "../../../language"
import type { WorkflowState } from "../../state"
import type { PromptBuilder } from "./types"

const MAX_ATTEMPTS = 5

export async function runPlainTextNode(
  state: WorkflowState,
  role: ModelRole,
  step: RoleTraceStep,
  promptBuilder: PromptBuilder,
  partial: Partial<Record<RoleTraceStep, string>>,
  emit: (event: RunEvent) => Promise<void>
): Promise<{ text: string; retries: number }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt = withPromptLanguageGuide(promptBuilder(state, partial), state.scenario.language)
    const result = await invokeRoleTextWithMetrics(state.settings, role, step, attempt, prompt)
    await emit({
      type: "model.metrics",
      runId: state.runId,
      timestamp: timestamp(),
      metrics: result.metrics,
    })
    const response = normalizePlainText(result.text)
    if (response) {
      await emit({
        type: "model.message",
        runId: state.runId,
        timestamp: timestamp(),
        role,
        content: `${step}: ${response}`,
      })
      return { text: response, retries: attempt - 1 }
    }

    await emit({
      type: "log",
      runId: state.runId,
      timestamp: timestamp(),
      level: "warn",
      message: `${role}.${step} returned empty text on attempt ${attempt}/${MAX_ATTEMPTS}.`,
    })
  }

  throw new Error(`${role}.${step} failed after ${MAX_ATTEMPTS} empty responses.`)
}

function normalizePlainText(value: string): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  return trimmed.length > 1200 ? trimmed.slice(0, 1200).trim() : trimmed
}

function timestamp(): string {
  return new Date().toISOString()
}
