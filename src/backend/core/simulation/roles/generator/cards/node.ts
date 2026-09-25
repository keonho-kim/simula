/**
 * Purpose: Generate one card field with scoped streaming, telemetry and bounded retries.
 * Pattern: Workflow node factory.
 * Usage: Bound to external context and runtime dependencies by the actor-card graph.
 * Related: src/backend/core/simulation/roles/generator/cards/context.ts, src/backend/core/simulation/roles/generator/cards/state.ts
 */
import { createBoardStream } from "@/backend/core/simulation/events/board-stream"
import type { ActorCardStep, RunEvent } from "@/shared"
import { invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { withRolePromptGuide } from "@/backend/core/prompts/language"
import { emitModelTelemetry } from "@/backend/core/simulation/events/telemetry"
import type { ActorCardPromptBuilder } from "@/backend/core/simulation/roles/generator/cards/prompts"
import type { ActorCardGraphState, ActorCardStepInput } from "@/backend/core/simulation/roles/generator/cards/state"

import type { ActorCardExecution } from "./context"

const MAX_ATTEMPTS = 5
const MAX_CARD_FIELD_CHARS = 1200

export function createActorCardStepNode(
  step: ActorCardStep,
  promptBuilder: ActorCardPromptBuilder,
  execution: ActorCardExecution
): (state: ActorCardGraphState) => Promise<Partial<ActorCardGraphState>> {
  return async (state) => {
    const result = await runActorCardTextNode({ ...execution.context, ...state }, step, promptBuilder, execution)
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
  state: ActorCardStepInput,
  step: ActorCardStep,
  promptBuilder: ActorCardPromptBuilder,
  execution: ActorCardExecution
): Promise<{ text: string; retries: number }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt = withRolePromptGuide(promptBuilder(state), {
      language: state.language,
      settings: execution.settings,
      role: "generator",
    })
    const stream = await createBoardStream(state.runId, execution.emit, "actor-" + state.actorIndex, step)
    const result = await invokeRoleTextWithMetrics(execution.settings, "generator", step, attempt, prompt, stream.onDelta)

    await emitModelTelemetry(state.runId, result, execution.emit)
    const response = normalizePlainText(result.text)
    if (response) {
      await execution.emit({
        type: "model.message",
        runId: state.runId,
        timestamp: timestamp(),
        role: "generator",
        content: `actor-${state.actorIndex} ${step}: ${response}`,
      })
      return { text: response, retries: attempt - 1 }
    }

    await emitEmptyAttempt(state, step, attempt, execution.emit)
  }

  throw new Error(`generator.actor-${state.actorIndex}.${step} failed after ${MAX_ATTEMPTS} empty responses.`)
}

async function emitEmptyAttempt(state: ActorCardStepInput, step: ActorCardStep, attempt: number, emit: ActorCardExecution["emit"]): Promise<void> {
  const event: RunEvent = {
    type: "log",
    runId: state.runId,
    timestamp: timestamp(),
    level: "warn",
    message: `generator.actor-${state.actorIndex}.${step} returned empty text on attempt ${attempt}/${MAX_ATTEMPTS}.`,
  }
  await emit(event)
}

function normalizePlainText(value: string): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  return trimmed.length > MAX_CARD_FIELD_CHARS ? trimmed.slice(0, MAX_CARD_FIELD_CHARS).trim() : trimmed
}

function timestamp(): string {
  return new Date().toISOString()
}
