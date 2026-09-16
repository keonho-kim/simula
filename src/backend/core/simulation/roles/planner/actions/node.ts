import { createBoardStream } from "@/backend/core/simulation/events/board-stream"
import type { ActionCatalog, RunEvent } from "@/shared"
import { invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { normalizePromptLanguage, withRolePromptGuide } from "@/backend/core/prompts/language"
import { compactText } from "@/backend/core/prompts/prompt"
import { plannerDigestSummary } from "@/backend/core/simulation/planning/digest"
import { emitModelTelemetry } from "@/backend/core/simulation/events/telemetry"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import { ACTION_SCOPES, parseActionBatch } from "./catalog"
import { actionCatalogPrompt } from "./prompts"

const MAX_ATTEMPTS = 5
const BATCH_SIZE = 3

export function createPlannerActionsNode(emit: (event: RunEvent) => Promise<void>) {
  return async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
    const plan = state.simulation.plan
    if (!plan) throw new Error("planner.actionCatalog requires the scenario plan first.")
    const catalog: ActionCatalog = {}
    const context = `Scenario: ${compactText(state.scenario.text, 1200)}\nPlan: ${compactText(plannerDigestSummary(plan, state.scenario.text), 1200)}\nMajor events: ${compactText(plan.majorEvents.map((event) => event.title).join("; "), 400)}`
    for (const visibility of ACTION_SCOPES) {
      for (let offset = 0; offset < state.scenario.controls.actionsPerType; offset += BATCH_SIZE) {
        const count = Math.min(BATCH_SIZE, state.scenario.controls.actionsPerType - offset)
        const failures = new Set<string>()
        let accepted = 0
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const requested = Math.min(count - accepted, attempt === 1 ? BATCH_SIZE : 1)
          const prompt = withRolePromptGuide(actionCatalogPrompt(context, visibility, requested, catalog, [...failures].join("\n")), {
            language: state.scenario.language, settings: state.settings, role: "planner",
          })
          const stream = await createBoardStream(state.runId, emit, "actions-pending", visibility)
          const result = await invokeRoleTextWithMetrics(state.settings, "planner", "actionCatalog", attempt, prompt, stream.onDelta)

          await emitModelTelemetry(state.runId, result, emit)
          const { actions, issues } = parseActionBatch(result.text, visibility, offset + accepted, requested, catalog, normalizePromptLanguage(state.scenario.language))
          for (const issue of issues) failures.add(issue)
          accepted += actions.length
          if (issues.length) await emit({ type: "log", runId: state.runId, timestamp: new Date().toISOString(), level: "warn",
            message: "planner.actionCatalog " + visibility + " batch " + (offset + 1) + " attempt " + attempt + "/" + MAX_ATTEMPTS + ": kept " + actions.length + " valid actions; " + (count - accepted) + " remaining. " + issues.join(" ") })
          if (!actions.length) continue
          for (const action of actions) catalog[action.id] = action
          await emit({ type: "model.message", runId: state.runId, timestamp: new Date().toISOString(), role: "planner",
            content: `actionCatalog ${visibility}: ${actions.map((action) => `${action.id} = ${action.label}`).join("; ")}` })
          await emit({ type: "board.updated", runId: state.runId, timestamp: new Date().toISOString(),
            update: { kind: "actions", actions } })
          if (accepted === count) break
        }
        if (accepted !== count) throw new Error(`planner.actionCatalog ${visibility} failed after ${MAX_ATTEMPTS} attempts (${accepted}/${count} accepted in batch; ${count - accepted} remaining): ${[...failures].join(" ")}`)
      }
    }
    return { simulation: { ...state.simulation, plan: { ...plan, actionCatalog: catalog } } }
  }
}
