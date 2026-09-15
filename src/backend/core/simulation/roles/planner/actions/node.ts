import type { ActionCatalog, ActorAction, RunEvent } from "@/shared"
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
        let error: string | undefined
        let accepted = false
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const prompt = withRolePromptGuide(actionCatalogPrompt(context, visibility, count, catalog, error), {
            language: state.scenario.language, settings: state.settings, role: "planner",
          })
          const result = await invokeRoleTextWithMetrics(state.settings, "planner", "actionCatalog", attempt, prompt)
          await emitModelTelemetry(state.runId, result, emit)
          let actions: ActorAction[]
          try {
            actions = parseActionBatch(result.text, visibility, offset, count, catalog, normalizePromptLanguage(state.scenario.language))
          } catch (cause) {
            error = cause instanceof Error ? cause.message : String(cause)
            await emit({ type: "log", runId: state.runId, timestamp: new Date().toISOString(), level: "warn",
              message: `planner.actionCatalog ${visibility} batch ${offset + 1} attempt ${attempt}/${MAX_ATTEMPTS}: ${error}` })
            continue
          }
          for (const action of actions) catalog[action.id] = action
          await emit({ type: "model.message", runId: state.runId, timestamp: new Date().toISOString(), role: "planner",
            content: `actionCatalog ${visibility}: ${actions.map((action) => `${action.id} = ${action.label}`).join("; ")}` })
          await emit({ type: "board.updated", runId: state.runId, timestamp: new Date().toISOString(),
            update: { kind: "actions", actions } })
          accepted = true
          break
        }
        if (!accepted) throw new Error(`planner.actionCatalog ${visibility} failed after ${MAX_ATTEMPTS} attempts: ${error}`)
      }
    }
    return { simulation: { ...state.simulation, plan: { ...plan, actionCatalog: catalog } } }
  }
}
