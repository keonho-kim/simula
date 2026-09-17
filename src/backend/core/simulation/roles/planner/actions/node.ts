import { createActionBoardStream } from "./stream"
import type { ActionCatalog, ActorAction, RunEvent } from "@/shared"
import { invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { normalizePromptLanguage, withRolePromptGuide } from "@/backend/core/prompts/language"
import { compactText } from "@/backend/core/prompts/prompt"
import { emitModelTelemetry } from "@/backend/core/simulation/events/telemetry"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import { ACTION_SCOPES, ActionLabelCollision, parseAction, recoverScopedLabel } from "./catalog"
import { actionCatalogPrompt } from "./prompts"

const MAX_ATTEMPTS = 5

export function createPlannerActionsNode(emit: (event: RunEvent) => Promise<void>) {
  return async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
    const plan = state.simulation.plan
    if (!plan) throw new Error("planner.actionCatalog requires the scenario plan first.")
    const catalog: ActionCatalog = {}
    const language = normalizePromptLanguage(state.scenario.language)
    const digest = plan.scenarioDigest
    const context = [
      `Scenario: ${compactText(state.scenario.text, 800)}`,
      ...(digest ? Object.entries(digest).map(([key, value]) => `${key}: ${compactText(value, 300)}`) : [`Plan: ${compactText(plan.backgroundStory, 1200)}`]),
      `Major events: ${compactText(plan.majorEvents.map(event => event.title).join("; "), 400)}`,
    ].join("\n")
    for (const visibility of ACTION_SCOPES) {
      for (let index = 0; index < state.scenario.controls.actionsPerType; index++) {
        const failures = new Set<string>()
        let action: ActorAction | undefined
        let collision: ActionLabelCollision | undefined
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const prompt = withRolePromptGuide(actionCatalogPrompt(context, visibility, index, catalog, language, [...failures]), {
            language, settings: state.settings, role: "planner",
          })
          const stream = await createActionBoardStream(state.runId, emit)
          const result = await invokeRoleTextWithMetrics(state.settings, "planner", "actionCatalog", attempt, prompt, stream.onDelta)
          await emitModelTelemetry(state.runId, result, emit)
          try { action = parseAction(result.text, visibility, index, catalog, language) } catch (error) {
            if (!(error instanceof Error)) throw error
            if (error instanceof ActionLabelCollision) collision = error
            failures.add(error.message)
            await emit({ type: "log", runId: state.runId, timestamp: new Date().toISOString(), level: "warn",
              message: `planner.actionCatalog ${visibility} action ${index + 1}/${state.scenario.controls.actionsPerType} attempt ${attempt}/${MAX_ATTEMPTS}: ${error.message}` })
            continue
          }
          break
        }
        if (!action && collision) {
          action = recoverScopedLabel(collision, catalog, language)
          if (action) await emit({ type: "log", runId: state.runId, timestamp: new Date().toISOString(), level: "warn",
            message: `planner.actionCatalog recovered ${action.id}: disambiguated "${collision.candidate.label}" as "${action.label}"; model-authored condition and effect retained.` })
        }
        if (!action && index > 0) {
          await emit({ type: "log", runId: state.runId, timestamp: new Date().toISOString(), level: "warn",
            message: `planner.actionCatalog recovered ${visibility}: retained ${index}/${state.scenario.controls.actionsPerType} validated actions after ${MAX_ATTEMPTS} unsuccessful attempts; remaining slots omitted. ${[...failures].join(" ")}` })
          break
        }
        if (!action) throw new Error(`planner.actionCatalog ${visibility} action ${index + 1}/${state.scenario.controls.actionsPerType} failed after ${MAX_ATTEMPTS} attempts (${index} already accepted in scope): ${[...failures].join(" ")}`)
        catalog[action.id] = action
        await emit({ type: "model.message", runId: state.runId, timestamp: new Date().toISOString(), role: "planner", content: JSON.stringify(action) })
        await emit({ type: "board.updated", runId: state.runId, timestamp: new Date().toISOString(), update: { kind: "actions", actions: [action] } })
      }
    }
    await emit({ type: "board.updated", runId: state.runId, timestamp: new Date().toISOString(), update: {
      kind: "config", actorCount: state.scenario.controls.numCast, actionCount: Object.keys(catalog).length,
    } })
    return { simulation: { ...state.simulation, plan: { ...plan, actionCatalog: catalog } } }
  }
}
