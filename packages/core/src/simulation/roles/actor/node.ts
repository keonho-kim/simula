import type { ActorTraceStep, RunEvent } from "@simula/shared"
import { invokeExactChoiceWithMetrics, invokeRoleTextWithMetrics } from "../../../llm"
import { withPromptLanguageGuide, withRolePromptGuide } from "../../../language"
import { scalePromptLimit } from "../../../prompt"
import { emitModelTelemetry } from "../../events"
import { repairExactChoice } from "../repair"
import type { ActorPromptBuilder } from "./prompts"
import type { ActorGraphState } from "./state"

const MAX_ATTEMPTS = 5

export async function runActorTextNode(
  state: ActorGraphState,
  step: ActorTraceStep,
  promptBuilder: ActorPromptBuilder,
  partial: Partial<Record<ActorTraceStep, string>>,
  emit: (event: RunEvent) => Promise<void>,
  validate?: (value: string, state: ActorGraphState) => boolean,
  allowedOutputs?: (state: ActorGraphState) => string[]
): Promise<{ text: string; retries: number }> {
  const invalidResponses: string[] = []
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const allowed = allowedOutputs?.(state) ?? []
    const retryGuide =
      validate && invalidResponses.length
        ? `\n\nPrevious invalid responses:\n${invalidResponses.map((item) => `- ${item}`).join("\n")}\nReturn one exact allowed output only:\n${allowed.map((item) => `- ${item}`).join("\n")}`
        : ""
    const basePrompt = promptBuilder(state, partial) + retryGuide
    const prompt =
      validate && allowed.length
        ? withPromptLanguageGuide(basePrompt, state.scenario.language)
        : withRolePromptGuide(basePrompt, {
            language: state.scenario.language,
            settings: state.settings,
            role: "actor",
          })
    const result = validate && allowed.length
      ? await invokeExactChoiceWithMetrics(state.settings, "actor", step, attempt, prompt, allowed)
      : await invokeRoleTextWithMetrics(state.settings, "actor", step, attempt, prompt)
    await emitModelTelemetry(state.runId, result, emit, { actorId: state.actor.id, actorName: state.actor.name })

    const response = validate ? result.text.trim() : normalizePlainText(result.text, state)
    if (response && (!validate || validate(response, state))) {
      await emit({
        type: "model.message",
        runId: state.runId,
        timestamp: timestamp(),
        role: "actor",
        content: `${state.actor.name} ${step}: ${response}`,
      })
      return { text: response, retries: attempt - 1 }
    }

    if (validate && allowedOutputs) {
      const repaired = await repairExactChoice({
        runId: state.runId,
        scenario: state.scenario,
        settings: state.settings,
        sourceRole: "actor",
        sourceStep: step,
        sourceId: state.actor.id,
        invalidText: response || "<empty>",
        allowedOutputs: allowed,
        emit,
      })
      if (repaired && validate(repaired, state)) {
        await emit({
          type: "model.message",
          runId: state.runId,
          timestamp: timestamp(),
          role: "actor",
          content: `${state.actor.name} ${step}: ${repaired}`,
        })
        return { text: repaired, retries: attempt - 1 }
      }
    }
    invalidResponses.push(preview(response))

    await emit({
      type: "log",
      runId: state.runId,
      timestamp: timestamp(),
      level: "warn",
      message: `actor.${step} for ${state.actor.id} returned invalid text on attempt ${attempt}/${MAX_ATTEMPTS}: ${preview(response)}`,
    })
  }

  throw new Error(`actor.${step} for ${state.actor.id} failed after ${MAX_ATTEMPTS} invalid responses.`)
}

function normalizePlainText(value: string, state: ActorGraphState): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  const maxCharacters = scalePromptLimit(700, state.scenario.controls)
  return trimmed.length > maxCharacters ? trimmed.slice(0, maxCharacters).trim() : trimmed
}

function preview(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim()
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact || "<empty>"
}

function timestamp(): string {
  return new Date().toISOString()
}
