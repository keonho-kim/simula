import type { ActorCardStep, RunEvent } from "@simula/shared"
import { invokeRoleTextWithMetrics } from "../../../llm"
import { withPromptLanguageGuide } from "../../../language"
import type { ActorCardPromptBuilder } from "./card-prompts"
import type { ActorCardGraphState } from "./card-state"

const MAX_ATTEMPTS = 5

export function createActorCardStepNode(
  step: ActorCardStep,
  promptBuilder: ActorCardPromptBuilder
): (state: ActorCardGraphState) => Promise<Partial<ActorCardGraphState>> {
  return async (state) => {
    const result = await runActorCardTextNode(state, step, promptBuilder)
    return {
      card: {
        ...state.card,
        [step]: result.text,
      },
      retryCounts: {
        ...state.retryCounts,
        [step]: result.retries,
      },
    }
  }
}

async function runActorCardTextNode(
  state: ActorCardGraphState,
  step: ActorCardStep,
  promptBuilder: ActorCardPromptBuilder
): Promise<{ text: string; retries: number }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt = withPromptLanguageGuide(promptBuilder(state), state.scenario.language)
    const result = await invokeRoleTextWithMetrics(state.settings, "generator", step, attempt, prompt)
    await state.emit({
      type: "model.metrics",
      runId: state.runId,
      timestamp: timestamp(),
      metrics: result.metrics,
    })
    const response = normalizePlainText(result.text)
    if (response) {
      await state.emit({
        type: "model.message",
        runId: state.runId,
        timestamp: timestamp(),
        role: "generator",
        content: `actor-${state.actorIndex} ${step}: ${response}`,
      })
      return { text: response, retries: attempt - 1 }
    }

    await emitEmptyAttempt(state, step, attempt)
  }

  throw new Error(`generator.actor-${state.actorIndex}.${step} failed after ${MAX_ATTEMPTS} empty responses.`)
}

async function emitEmptyAttempt(state: ActorCardGraphState, step: ActorCardStep, attempt: number): Promise<void> {
  const event: RunEvent = {
    type: "log",
    runId: state.runId,
    timestamp: timestamp(),
    level: "warn",
    message: `generator.actor-${state.actorIndex}.${step} returned empty text on attempt ${attempt}/${MAX_ATTEMPTS}.`,
  }
  await state.emit(event)
}

function normalizePlainText(value: string): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  return trimmed.length > 1200 ? trimmed.slice(0, 1200).trim() : trimmed
}

function timestamp(): string {
  return new Date().toISOString()
}
