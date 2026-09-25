/**
 * Purpose: Invoke and validate coordinator model steps with bounded recovery.
 * Pattern: Adapter boundary.
 * Usage: Coordinator graph nodes call these functions for prose and exact choices.
 * Related: src/backend/integrations/llm/invoke.ts, src/backend/core/simulation/roles/repair.ts
 */
import { retryChoice } from "../repair/prompts/retry-choice"
import type { CoordinatorTrace, CoordinatorTraceStep, PlannedEvent, RunEvent } from "@/shared"
import { invokeExactChoiceWithMetrics, invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { withPromptLanguageGuide, withRolePromptGuide } from "@/backend/core/prompts/language"
import { scalePromptLimit } from "@/backend/core/prompts/prompt"
import {
  eventInjectionAllowedOutputs,
  eventInjectionDisplayValue,
  isInjectableEvent,
  selectEventInjection,
} from "@/backend/core/simulation/events/injection"
import { emitModelTelemetry } from "@/backend/core/simulation/events/telemetry"
import { repairExactChoice } from "@/backend/core/simulation/roles/repair"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import type { CoordinatorPromptBuilder } from "./prompts"
import { coordinatorPrompts } from "./prompts"

const MAX_COORDINATOR_ATTEMPTS = 5

export interface CoordinatorStepResult {
  text: string
  retries: number
}

export async function runCoordinatorText(
  state: WorkflowState,
  step: CoordinatorTraceStep,
  promptBuilder: CoordinatorPromptBuilder,
  partial: Partial<Record<CoordinatorTraceStep, string>>,
  emit: (event: RunEvent) => Promise<void>
): Promise<CoordinatorStepResult> {
  for (let attempt = 1; attempt <= MAX_COORDINATOR_ATTEMPTS; attempt += 1) {
    const prompt = withRolePromptGuide(promptBuilder(state, partial), {
      language: state.scenario.language,
      settings: state.settings,
      role: "coordinator",
    })
    const result = await invokeRoleTextWithMetrics(state.settings, "coordinator", step, attempt, prompt)
    await emitModelTelemetry(state.runId, result, emit)
    const response = normalizeCoordinatorText(result.text, step, state)
    if (response) {
      await emitMessage(state.runId, step, response, emit)
      return { text: response, retries: attempt - 1 }
    }
    await emitWarning(
      state.runId,
      `coordinator.${step} returned empty text on attempt ${attempt}/${MAX_COORDINATOR_ATTEMPTS}.`,
      emit
    )
  }
  throw new Error(`coordinator.${step} failed after ${MAX_COORDINATOR_ATTEMPTS} empty responses.`)
}

export async function runCoordinatorChoice(
  state: WorkflowState,
  step: CoordinatorTraceStep,
  promptBuilder: CoordinatorPromptBuilder,
  emit: (event: RunEvent) => Promise<void>,
  select: (value: string) => string | undefined,
  allowedOutputs: readonly string[],
  displayValue: (value: string) => string = (value) => value
): Promise<CoordinatorStepResult> {
  const invalidResponses: string[] = []
  for (let attempt = 1; attempt <= MAX_COORDINATOR_ATTEMPTS; attempt += 1) {
    const retryGuide = retryChoice(invalidResponses, allowedOutputs)
    const prompt = withPromptLanguageGuide(
      promptBuilder(state, {}) + retryGuide,
      state.scenario.language
    )
    const result = await invokeExactChoiceWithMetrics(
      state.settings,
      "coordinator",
      step,
      attempt,
      prompt,
      [...allowedOutputs]
    )
    await emitModelTelemetry(state.runId, result, emit)
    const response = result.text.trim()
    const selected = select(response)
    if (selected) {
      await emitMessage(state.runId, step, displayValue(selected), emit)
      return { text: selected, retries: attempt - 1 }
    }
    const repaired = await repairExactChoice({
      runId: state.runId,
      scenario: state.scenario,
      settings: state.settings,
      sourceRole: "coordinator",
      sourceStep: step,
      invalidText: response || "<empty>",
      allowedOutputs: [...allowedOutputs],
      emit,
    })
    const repairedSelection = repaired ? select(repaired) : undefined
    if (repairedSelection) {
      await emitMessage(state.runId, step, displayValue(repairedSelection), emit)
      return { text: repairedSelection, retries: attempt - 1 }
    }
    invalidResponses.push(preview(response))
    await emitWarning(
      state.runId,
      `coordinator.${step} returned invalid text on attempt ${attempt}/${MAX_COORDINATOR_ATTEMPTS}: ${preview(response)}`,
      emit
    )
  }
  throw new Error(`coordinator.${step} failed after ${MAX_COORDINATOR_ATTEMPTS} invalid responses.`)
}

export async function resolveEventInjection(
  state: WorkflowState,
  events: PlannedEvent[],
  emit: (event: RunEvent) => Promise<void>
): Promise<CoordinatorStepResult> {
  if (!events.some(isInjectableEvent)) {
    return { text: "None", retries: 0 }
  }
  const outputs = eventInjectionAllowedOutputs(events)
  return runCoordinatorChoice(
    state,
    "eventInjection",
    coordinatorPrompts.eventInjection,
    emit,
    (value) => selectEventInjection(value, events),
    outputs,
    (value) => eventInjectionDisplayValue(value, events)
  )
}

export function updateCoordinatorTrace(
  trace: CoordinatorTrace,
  step: CoordinatorTraceStep,
  text: string,
  retries: number
): CoordinatorTrace {
  return {
    ...trace,
    [step]: text,
    retryCounts: { ...trace.retryCounts, [step]: retries },
  }
}

function normalizeCoordinatorText(
  value: string,
  step: CoordinatorTraceStep,
  state: WorkflowState
): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  const labels = [step, coordinatorStepLabel(step), coordinatorStepLabel(step).replace(/\s+/g, "")]
  const withoutPrefix = labels.reduce((current, label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return current.replace(
      new RegExp(`^\\s*(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*[:：-]\\s*`, "i"),
      ""
    )
  }, trimmed)
  const maxCharacters = scalePromptLimit(700, state.scenario.controls)
  return withoutPrefix.length > maxCharacters
    ? withoutPrefix.slice(0, maxCharacters).trim()
    : withoutPrefix
}

function coordinatorStepLabel(step: CoordinatorTraceStep): string {
  if (step === "runtimeFrame") return "Runtime Frame"
  if (step === "actorRouting") return "Actor Routing"
  if (step === "interactionPolicy") return "Interaction Policy"
  if (step === "outcomeDirection") return "Outcome Direction"
  if (step === "eventInjection") return "Event Injection"
  if (step === "eventResolution") return "Event Resolution"
  return "Progress Decision"
}

async function emitMessage(
  runId: string,
  step: CoordinatorTraceStep,
  content: string,
  emit: (event: RunEvent) => Promise<void>
): Promise<void> {
  await emit({
    type: "model.message",
    runId,
    timestamp: timestamp(),
    role: "coordinator",
    content: `${step}: ${content}`,
  })
}

async function emitWarning(
  runId: string,
  message: string,
  emit: (event: RunEvent) => Promise<void>
): Promise<void> {
  await emit({ type: "log", runId, timestamp: timestamp(), level: "warn", message })
}

function preview(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim()
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact || "<empty>"
}

function timestamp(): string {
  return new Date().toISOString()
}
