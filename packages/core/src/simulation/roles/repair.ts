import type { ActorTraceStep, CoordinatorTraceStep, RunEvent, ScenarioInput, LLMSettings } from "@simula/shared"
import { invokeExactChoiceWithMetrics } from "../../llm"
import { withPromptLanguageGuide } from "../../language"
import { emitModelTelemetry, timestamp } from "../events"

interface RepairChoiceInput {
  runId: string
  scenario: ScenarioInput
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

export function buildRepairChoicePrompt(input: Pick<RepairChoiceInput, "sourceRole" | "sourceStep" | "sourceId" | "invalidText" | "allowedOutputs">): string {
  return `Repair ${input.sourceRole}.${input.sourceStep}.
Return exactly one allowed output from the list.
No explanation, markdown, punctuation, or translation.

Source: ${input.sourceRole}${input.sourceId ? ` ${input.sourceId}` : ""}
Invalid response:
${input.invalidText}

Allowed outputs:
${input.allowedOutputs.map((output) => `- ${output}`).join("\n")}`
}

function preview(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim()
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact || "<empty>"
}
