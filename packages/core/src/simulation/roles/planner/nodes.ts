import type { PlannerTrace, PlannerTraceStep, RunEvent } from "@simula/shared"
import { invokeRoleTextWithMetrics } from "../../../llm"
import { withRolePromptGuide } from "../../../language"
import { emitModelTelemetry } from "../../events"
import { upsertRoleTrace } from "../../state"
import type { WorkflowState } from "../../state"
import type { PlannerPromptBuilder } from "./prompts"
import { applyPlannerTrace, getPlannerTrace, plannerTracePartial } from "./state"

const MAX_ATTEMPTS = 5

export function createPlannerStepNode(
  step: PlannerTraceStep,
  promptBuilder: PlannerPromptBuilder,
  emit: (event: RunEvent) => Promise<void>
): (state: WorkflowState) => Promise<Partial<WorkflowState>> {
  return async (state) => {
    const currentTrace = getPlannerTrace(state.simulation)
    const partial = plannerTracePartial(currentTrace)
    const result = await runPlannerTextNode(state, step, promptBuilder, partial, emit)
    const nextTrace: PlannerTrace = {
      ...currentTrace,
      [step]: result.text,
      retryCounts: {
        ...currentTrace.retryCounts,
        [step]: result.retries,
      },
    }

    return {
      simulation: upsertRoleTrace(state.simulation, nextTrace),
    }
  }
}

export async function plannerNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const trace = getPlannerTrace(state.simulation)
  return {
    simulation: applyPlannerTrace(state.simulation, state.scenario, trace),
  }
}

async function runPlannerTextNode(
  state: WorkflowState,
  step: PlannerTraceStep,
  promptBuilder: PlannerPromptBuilder,
  partial: Partial<Record<PlannerTraceStep, string>>,
  emit: (event: RunEvent) => Promise<void>
): Promise<{ text: string; retries: number }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt = withRolePromptGuide(promptBuilder(state, partial), {
      language: state.scenario.language,
      settings: state.settings,
      role: "planner",
    })
    const result = await invokeRoleTextWithMetrics(state.settings, "planner", step, attempt, prompt)
    await emitModelTelemetry(state.runId, result, emit)
    const response = step === "majorEvents" ? normalizePlannerMajorEvents(result.text) : normalizePlannerDigest(result.text)
    if (response) {
      await emit({
        type: "model.message",
        runId: state.runId,
        timestamp: timestamp(),
        role: "planner",
        content: `${step}: ${response}`,
      })
      return { text: response, retries: attempt - 1 }
    }

    await emit({
      type: "log",
      runId: state.runId,
      timestamp: timestamp(),
      level: "warn",
      message: `planner.${step} returned empty text on attempt ${attempt}/${MAX_ATTEMPTS}.`,
    })
  }

  throw new Error(`planner.${step} failed after ${MAX_ATTEMPTS} empty responses.`)
}

function normalizePlannerDigest(value: string): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  const withoutPrefix = trimmed.replace(
    /^(?:\*\*)?(?:Core Situation|Actor Pressure|Conflict Dynamics|Simulation Direction|Core Situation Digest|Actor Pressure Digest|Conflict Dynamics Digest|Simulation Direction Digest|상황 요약|행위자 압력 요약|갈등 동역학 요약|시뮬레이션 방향 요약)(?:\*\*)?\s*[:：]\s*/i,
    ""
  )
  return withoutPrefix.length > 1200 ? withoutPrefix.slice(0, 1200).trim() : withoutPrefix
}

function normalizePlannerMajorEvents(value: string): string {
  return value
    .replace(/```/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
}

function timestamp(): string {
  return new Date().toISOString()
}
