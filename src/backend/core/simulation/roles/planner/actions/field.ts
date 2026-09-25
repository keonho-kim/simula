/**
 * Purpose: Invoke and retry one streamed action-catalog field without discarding accepted siblings.
 * Pattern: Bounded model task.
 * Usage: Called by the Planner action-catalog node for label, intent and outcome.
 * Related: src/backend/core/simulation/roles/planner/actions/node.ts, src/backend/core/simulation/events/board-stream.ts
 */
import type { ActionVisibility, PromptLanguage, RunEvent } from "@/shared"
import { assertCompleteModelOutput, invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { withRolePromptGuide } from "@/backend/core/prompts/language"
import { emitModelTelemetry } from "@/backend/core/simulation/events/telemetry"
import { createBoardStream } from "@/backend/core/simulation/events/board-stream"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import { ActionLabelCollision, type ActionField } from "./catalog"

export const MAX_ACTION_FIELD_ATTEMPTS = 5

interface FieldTask {
  state: WorkflowState
  emit: (event: RunEvent) => Promise<void>
  visibility: ActionVisibility
  index: number
  field: ActionField
  language: PromptLanguage
  prompt: (errors: string[]) => string
  accept: (text: string) => string
}

export async function generateActionField(task: FieldTask): Promise<{
  value?: string; failures: string[]; collision?: ActionLabelCollision
}> {
  const failures = new Set<string>()
  let collision: ActionLabelCollision | undefined
  for (let attempt = 1; attempt <= MAX_ACTION_FIELD_ATTEMPTS; attempt++) {
    const prompt = withRolePromptGuide(task.prompt([...failures]), {
      language: task.language, settings: task.state.settings, role: "planner",
    })
    const stream = await createBoardStream(task.state.runId, task.emit, "actions-pending", task.field)
    const result = await invokeRoleTextWithMetrics(task.state.settings, "planner", "actionCatalog", attempt, prompt,
      stream.onDelta)
    await emitModelTelemetry(task.state.runId, result, task.emit)
    try {
      assertCompleteModelOutput(result)
      return { value: task.accept(result.text), failures: [...failures] }
    } catch (error) {
      if (!(error instanceof Error)) throw error
      if (error instanceof ActionLabelCollision) collision = error
      failures.add(error.message)
      await task.emit({ type: "log", runId: task.state.runId, timestamp: new Date().toISOString(), level: "warn",
        message: `planner.actionCatalog ${task.visibility} action ${task.index + 1}/${task.state.scenario.controls.actionsPerType} ${task.field} attempt ${attempt}/${MAX_ACTION_FIELD_ATTEMPTS}: ${error.message}` })
    }
  }
  return { failures: [...failures], collision }
}
