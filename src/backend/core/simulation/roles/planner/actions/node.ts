/**
 * Purpose: Assemble each Planner action from three independently accepted model fields.
 * Pattern: Sequential workflow node.
 * Usage: Called by the Planner graph actionCatalog stage.
 * Related: src/backend/core/simulation/roles/planner/actions/field.ts, src/backend/core/simulation/roles/planner/actions/catalog.ts
 */
import type { ActionCatalog, ActionVisibility, ActorAction, PromptLanguage, RunEvent } from "@/shared"
import { compactText } from "@/backend/core/prompts/prompt"
import { renderWorldConstraints } from "@/backend/core/simulation/planning/world-constraints"
import { normalizePromptLanguage } from "@/backend/core/prompts/language"
import { createBoardStream } from "@/backend/core/simulation/events/board-stream"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import { ACTION_FIELDS, ACTION_SCOPES, acceptActionDetail, acceptActionLabel, assembleAction, recoverScopedLabel,
  type ActionField } from "./catalog"
import { generateActionField, MAX_ACTION_FIELD_ATTEMPTS } from "./field"
import { actionLabelPrompt } from "./prompts/label"
import { actionIntentPrompt } from "./prompts/intent"
import { actionOutcomePrompt } from "./prompts/outcome"

export function createPlannerActionsNode(emit: (event: RunEvent) => Promise<void>) {
  return async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
    const plan = state.simulation.plan
    if (!plan) throw new Error("planner.actionCatalog requires the scenario plan first.")
    const catalog: ActionCatalog = {}
    const language = normalizePromptLanguage(state.scenario.language)
    const digest = plan.scenarioDigest
    const context = [
      renderWorldConstraints(state.scenario.world),
      `Scenario: ${compactText(state.scenario.text, 800)}`,
      ...(digest ? Object.entries(digest).map(([key, value]) => `${key}: ${compactText(value, 300)}`) : [`Plan: ${compactText(plan.backgroundStory, 1200)}`]),
      `Major events: ${compactText(plan.majorEvents.map(event => event.title).join("; "), 400)}`,
    ].join("\n")
    for (const visibility of ACTION_SCOPES) {
      for (let index = 0; index < state.scenario.controls.actionsPerType; index++) {
        const action = await generatePlannerAction({ state, emit, visibility, index, catalog, context, language })
        if (!action) break
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

interface ActionTask {
  state: WorkflowState
  emit: (event: RunEvent) => Promise<void>
  visibility: ActionVisibility
  index: number
  catalog: ActionCatalog
  context: string
  language: PromptLanguage
}

async function generatePlannerAction(task: ActionTask): Promise<ActorAction | undefined> {
  for (const field of ACTION_FIELDS) await createBoardStream(task.state.runId, task.emit, "actions-pending", field)
  const common = { state: task.state, emit: task.emit, visibility: task.visibility,
    index: task.index, language: task.language }
  const labelResult = await generateActionField({ ...common, field: "label",
    prompt: errors => actionLabelPrompt(task.context, task.visibility, task.index, task.catalog, task.language, errors),
    accept: text => acceptActionLabel(text, task.catalog) })
  let label = labelResult.value
  if (!label && labelResult.collision) {
    label = recoverScopedLabel(labelResult.collision, task.visibility, task.catalog, task.language)
    if (label) await task.emit({ type: "log", runId: task.state.runId, timestamp: new Date().toISOString(), level: "warn",
      message: `planner.actionCatalog recovered ${task.visibility} action ${task.index + 1}: disambiguated "${labelResult.collision.label}" as "${label}".` })
  }
  if (!label) return unresolvedField(task, "label", labelResult.failures)
  const acceptedLabel = label

  const intentResult = await generateActionField({ ...common, field: "intentHint",
    prompt: errors => actionIntentPrompt(task.context, task.visibility, acceptedLabel, task.language, errors),
    accept: text => acceptActionDetail(text, "intentHint") })
  if (!intentResult.value) return unresolvedField(task, "intentHint", intentResult.failures)
  const intentHint = intentResult.value

  const outcomeResult = await generateActionField({ ...common, field: "expectedOutcome",
    prompt: errors => actionOutcomePrompt(task.context, task.visibility, acceptedLabel, intentHint, task.language, errors),
    accept: text => acceptActionDetail(text, "expectedOutcome") })
  if (!outcomeResult.value) return unresolvedField(task, "expectedOutcome", outcomeResult.failures)
  return assembleAction({ label: acceptedLabel, intentHint, expectedOutcome: outcomeResult.value }, task.visibility, task.index)
}

async function unresolvedField(task: ActionTask, field: ActionField, failures: string[]): Promise<undefined> {
  const cause = failures.join(" ")
  if (task.index === 0) throw new Error(`planner.actionCatalog ${task.visibility} action 1/${task.state.scenario.controls.actionsPerType} ${field} failed after ${MAX_ACTION_FIELD_ATTEMPTS} attempts: ${cause}`)
  await task.emit({ type: "log", runId: task.state.runId, timestamp: new Date().toISOString(), level: "warn",
    message: `planner.actionCatalog recovered ${task.visibility}: retained ${task.index}/${task.state.scenario.controls.actionsPerType} accepted actions; remaining slots omitted after ${field} failed. ${cause}` })
  return undefined
}
