/**
 * Purpose: Project the visible context and output choices for role prompts.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/actor/state.ts
 */
import { compactText, scalePromptLimit } from "@/backend/core/prompts/prompt"
import type { ActorStepInput } from "@/backend/core/simulation/roles/actor/state"
import { targetActors } from "@/backend/core/simulation/roles/actor/state"

export function coordinatorDirective(value: string, step: string, label: string): string {
  const aliases = [step, label, label.replace(/\s+/g, ""), `Coordinator ${step}`, `Coordinator ${label}`]
  return aliases.reduce((current, alias) => {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return current.replace(new RegExp(`^\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?${escapedAlias}(?:\\*\\*)?\\s*[:：-]\\s*`, "i"), "")
  }, value.trim())
}

export function actorActionSummary(state: ActorStepInput, actionId: string | undefined): string {
  const normalized = actionId?.trim()
  if (!normalized || normalized === "no_action") {
    return "no_action"
  }
  const action = state.actor.actions.find((item) => item.id === normalized)
  return action ? `${action.id} (${action.visibility}, ${action.label})` : normalized
}

export function targetSelectionSummary(state: ActorStepInput, targetId: string | undefined): string {
  const normalized = targetId?.trim()
  if (!normalized || normalized === "None" || normalized === "none") {
    return "None"
  }
  const target = state.actors.find((actor) => actor.id === normalized)
  return target ? `${target.id} (${target.name}, ${target.role})` : normalized
}

export function actionPromptOutputs(state: ActorStepInput): string {
  const actions =
    targetActors(state).length === 0
      ? state.actor.actions.filter((action) => action.visibility === "solitary")
      : state.actor.actions
  return actions.map((action) => `- ${action.id} (${action.label}). Use when: ${action.intentHint} Effect: ${action.expectedOutcome}`).join("\n")
}

export function targetPromptOutputs(state: ActorStepInput, actionId: string | undefined): string {
  const normalized = actionId?.trim()
  const action = state.actor.actions.find((item) => item.id === normalized)
  if (!normalized || normalized === "no_action" || !action || action.visibility === "solitary") {
    return "- None"
  }
  return targetActors(state).map((actor) => `- ${actor.id}`).join("\n")
}

export function targetPromptContext(state: ActorStepInput, actionId: string | undefined): string {
  const normalized = actionId?.trim()
  const action = state.actor.actions.find((item) => item.id === normalized)
  if (!normalized || normalized === "no_action" || !action || action.visibility === "solitary") {
    return "- None"
  }
  return targetActors(state)
    .map((actor) => `${actor.id}: ${actor.name} (${actor.role}). ${compactText(actor.backgroundHistory, scalePromptLimit(150, state.scenario.controls))}`)
    .join("\n")
}
