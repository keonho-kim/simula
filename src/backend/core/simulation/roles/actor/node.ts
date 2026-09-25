/**
 * Purpose: Invoke and validate one actor decision field with bounded retries.
 * Pattern: Workflow step node.
 * Usage: Called by the actor graph through createActorStepNode.
 * Related: src/backend/core/simulation/roles/actor/prompts/index.ts, src/backend/core/simulation/roles/actor/nodes.ts
 */
import { retryChoice } from "../repair/prompts/retry-choice"
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { ActorTraceStep, LLMSettings, RunEvent } from "@/shared"
import { invokeExactChoiceWithMetrics, invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { withPromptLanguageGuide, withRolePromptGuide } from "@/backend/core/prompts/language"
import { scalePromptLimit } from "@/backend/core/prompts/prompt"
import { emitModelTelemetry } from "@/backend/core/simulation/events/telemetry"
import { repairExactChoice } from "@/backend/core/simulation/roles/repair"
import type { ActorPromptBuilder } from "@/backend/core/simulation/roles/actor/prompts"
import { retryMessage } from "./prompts/retry-message"
import { retrySection } from "./prompts/retry-section"
import { normalizeActorMessage } from "@/backend/core/simulation/roles/actor/state"
import type { ActorStepInput } from "@/backend/core/simulation/roles/actor/state"

const MAX_ATTEMPTS = 5
const MAX_MESSAGE_ATTEMPTS = 3

export async function runActorTextNode(
  state: ActorStepInput,
  settings: LLMSettings,
  step: ActorTraceStep,
  promptBuilder: ActorPromptBuilder,
  partial: Partial<Record<ActorTraceStep, string>>,
  emit: (event: RunEvent) => Promise<void>,
  validate?: (value: string, state: ActorStepInput) => boolean,
  allowedOutputs?: (state: ActorStepInput) => string[]
): Promise<{ text: string; retries: number }> {
  const invalidResponses: string[] = []
  const maxAttempts = step === "message" ? MAX_MESSAGE_ATTEMPTS : MAX_ATTEMPTS
  let responseIssue = ""
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const allowed = allowedOutputs?.(state) ?? []
    const retryGuide = validate && invalidResponses.length
      ? retryChoice(invalidResponses, allowed)
      : responseIssue ? `\n\n${renderPromptBlock("FEEDBACK", responseIssue)}` : ""
    const basePrompt = promptBuilder(state, partial) + retryGuide
    const prompt =
      validate && allowed.length
        ? withPromptLanguageGuide(basePrompt, state.scenario.language)
        : withRolePromptGuide(basePrompt, {
            language: state.scenario.language,
            settings: settings,
            role: "actor",
          })
    const result = validate && allowed.length
      ? await invokeExactChoiceWithMetrics(settings, "actor", step, attempt, prompt, allowed)
      : await invokeRoleTextWithMetrics(settings, "actor", step, attempt, prompt)
    await emitModelTelemetry(state.runId, result, emit, { actorId: state.actor.id, actorName: state.actor.name })

    const rawResponse = validate ? result.text.trim() : normalizePlainText(result.text, state)
    const formatIssue = validate ? "" : roleSectionIssue(rawResponse, step, state)
    const response = formatIssue ? rawResponse : stripCurrentRoleLabel(rawResponse, step)
    responseIssue = formatIssue || (step === "message" ? messageFeedback(response, partial, state) : "")
    if (response && !responseIssue && (!validate || validate(response, state))) {
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
        settings: settings,
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
      message: `actor.${step} for ${state.actor.id} returned invalid text on attempt ${attempt}/${maxAttempts}: ${responseIssue || preview(response)}`,
    })
  }

  throw new Error(`actor.${step} for ${state.actor.id} failed after ${maxAttempts} invalid responses.${responseIssue ? ` ${responseIssue}` : ""}`)
}

function roleSectionIssue(response: string, step: ActorTraceStep, state: ActorStepInput): string {
  if (step !== "thought" && step !== "intent" && step !== "message") return ""
  const labels = [...response.matchAll(/(?:^|[\s/])(Thought|Intent|Message|생각|의도|발화)\s*[:：]/gi)]
  if (!labels.length) return ""
  const expected = step === "thought" ? ["thought", "생각"] : step === "intent" ? ["intent", "의도"] : ["message", "발화"]
  if (labels.length === 1 && labels[0].index === 0 && expected.includes(labels[0][1].toLowerCase())) return ""
  return retrySection(state.scenario.language)
}

function stripCurrentRoleLabel(response: string, step: ActorTraceStep): string {
  if (step === "thought") return response.replace(/^(?:Thought|생각)\s*[:：]\s*/i, "")
  if (step === "intent") return response.replace(/^(?:Intent|의도)\s*[:：]\s*/i, "")
  if (step === "message") return response.replace(/^(?:Message|발화)\s*[:：]\s*/i, "")
  return response
}

function normalizePlainText(value: string, state: ActorStepInput): string {
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

function messageFeedback(response: string, partial: Partial<Record<ActorTraceStep, string>>, state: ActorStepInput): string {
  if (!response) return retryMessage({ kind: "empty" }, state.scenario.language)
  if (!normalizeActorMessage(response)) return ""
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}]/gu, "")
  const spoken = normalize(response)
  // Compare whole texts only: shared meaning or a shared phrase is not an error.
  const source = (["thought", "intent"] as const).find(key => spoken && spoken === normalize(partial[key] ?? ""))
  if (!source) return ""
  return retryMessage({ kind: "copied", source, excerpt: preview(response) }, state.scenario.language)
}
