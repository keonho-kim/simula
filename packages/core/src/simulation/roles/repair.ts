import type { ActorTraceStep, CoordinatorTraceStep, RunEvent, ScenarioInput, LLMSettings } from "@simula/shared"
import { invokeRoleTextWithMetrics } from "../../llm"
import { withPromptLanguageGuide } from "../../language"

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
  const result = await invokeRoleTextWithMetrics(input.settings, "repair", input.sourceStep, 1, prompt)
  await input.emit({
    type: "model.metrics",
    runId: input.runId,
    timestamp: timestamp(),
    metrics: result.metrics,
  })

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
  return `Repair an invalid ${input.sourceRole}.${input.sourceStep} response.
Return exactly one allowed output from the list.
Do not explain. Do not use Markdown. Do not add punctuation. Do not translate the output.

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

function timestamp(): string {
  return new Date().toISOString()
}
