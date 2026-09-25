/**
 * Purpose: Retry a rejected finite choice through the configured repair role.
 * Pattern: Simple Module.
 * Usage: Imported by the owning workflow.
 * Related: src/backend/core/simulation/roles/repair/prompts/exact-choice.ts
 */
import { buildRepairChoicePrompt } from "./repair/prompts/exact-choice"
import type { ActorTraceStep, CoordinatorTraceStep, RunEvent, ScenarioInput, LLMSettings } from "@/shared"
import { invokeExactChoiceWithMetrics } from "@/backend/integrations/llm"
import { withPromptLanguageGuide } from "@/backend/core/prompts/language"
import { emitModelTelemetry, timestamp } from "@/backend/core/simulation/events/telemetry"

interface RepairChoiceInput {
  runId: string
  scenario: Pick<ScenarioInput, "language">
  settings: LLMSettings
  sourceRole: "actor" | "coordinator"
  sourceStep: ActorTraceStep | CoordinatorTraceStep
  sourceId?: string
  invalidText: string
  allowedOutputs: string[]
  emit: (event: RunEvent) => Promise<void>
}

export async function repairExactChoice(input: RepairChoiceInput): Promise<string | undefined> {
  const prompt = withPromptLanguageGuide(buildRepairChoicePrompt(input), input.scenario.language)
  const result = await invokeExactChoiceWithMetrics(input.settings, "repair", input.sourceStep, 1, prompt, input.allowedOutputs)
  await emitModelTelemetry(input.runId, result, input.emit)

  const repaired = result.text.trim()
  if (input.allowedOutputs.includes(repaired)) {
    await input.emit({
      type: "model.message",
      runId: input.runId,
      timestamp: timestamp(),
      role: "repair",
      content: `${input.sourceRole}.${input.sourceStep}${input.sourceId ? ` ${input.sourceId}` : ""}: ${repaired}`,
    })
    return repaired
  }

  await input.emit({
    type: "log",
    runId: input.runId,
    timestamp: timestamp(),
    level: "warn",
    message: `repair.${input.sourceRole}.${input.sourceStep} returned invalid text: ${preview(repaired)}`,
  })
  return undefined
}


function preview(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim()
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact || "<empty>"
}
