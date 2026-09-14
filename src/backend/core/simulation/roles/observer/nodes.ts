import type { ObserverTrace, ObserverTraceStep, RunEvent } from "@/shared"
import { invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { withRolePromptGuide } from "@/backend/core/prompts/language"
import { scalePromptLimit } from "@/backend/core/prompts/prompt"
import { emitModelTelemetry, emitNodeCompleted, emitNodeStarted, timestamp } from "@/backend/core/simulation/events/telemetry"
import { upsertRoleTrace, type WorkflowState } from "@/backend/core/simulation/workflow/state"

import { applyObserverRound } from "@/backend/core/simulation/roles/observer/state"
import { observerPrompts } from "@/backend/core/simulation/roles/observer/prompts"

const MAX_ATTEMPTS = 5

export async function runObserverRound(
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>
): Promise<WorkflowState> {
  await emitNodeStarted(state.runId, "observer", "Observer", emit)
  const result = await runObserverTextNode(state, emit)
  const trace: ObserverTrace = {
    role: "observer",
    roundSummary: result.text,
    retryCounts: { roundSummary: result.retries },
  }
  const nextState = {
    ...state,
    simulation: applyObserverRound(upsertRoleTrace(state.simulation, trace)),
  }
  await emitNodeCompleted(state.runId, "observer", "Observer", emit)
  return nextState
}

async function runObserverTextNode(
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>
): Promise<{ text: string; retries: number }> {
  const step: ObserverTraceStep = "roundSummary"
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt = withRolePromptGuide(observerPrompts[step](state), {
      language: state.scenario.language,
      settings: state.settings,
      role: "observer",
    })
    const result = await invokeRoleTextWithMetrics(state.settings, "observer", step, attempt, prompt)
    await emitModelTelemetry(state.runId, result, emit)
    const response = normalizeObserverText(result.text, step, state)
    if (response) {
      await emit({
        type: "model.message",
        runId: state.runId,
        timestamp: timestamp(),
        role: "observer",
        content: `${step}: ${response}`,
      })
      return { text: response, retries: attempt - 1 }
    }

    await emit({
      type: "log",
      runId: state.runId,
      timestamp: timestamp(),
      level: "warn",
      message: `observer.${step} returned empty text on attempt ${attempt}/${MAX_ATTEMPTS}.`,
    })
  }

  throw new Error(`observer.${step} failed after ${MAX_ATTEMPTS} empty responses.`)
}

function normalizeObserverText(value: string, _step: ObserverTraceStep, state: WorkflowState): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  const maxCharacters = scalePromptLimit(1000, state.scenario.controls)
  return trimmed.length > maxCharacters ? trimmed.slice(0, maxCharacters).trim() : trimmed
}
