/**
 * Purpose: Project bounded round evidence and parse binary progress decisions.
 * Pattern: Pure projection and parser.
 * Usage: Called once per autonomous round by coordinator nodes.
 * Related: src/backend/core/simulation/roles/coordinator/nodes.ts
 */
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import { compactText, scalePromptLimit } from "@/backend/core/prompts/prompt"

export function progressSnapshot(state: WorkflowState): string {
  const { simulation, scenario } = state
  const roundIndex = simulation.roundDigests.at(-1)?.roundIndex ?? 0
  const text = (value: string) => compactText(value, scalePromptLimit(500, scenario.controls))
  return JSON.stringify({
    roundIndex,
    situation: text(simulation.roundDigests.at(-1)?.preRound.content ?? scenario.text),
    events: simulation.plan?.majorEvents.map(event => ({ id: event.id, title: event.title, status: event.status, summary: text(event.summary) })) ?? [],
    actors: simulation.actors.map(actor => ({ id: actor.id, name: actor.name, intent: text(actor.intent), memory: text(actor.contextSummary), relationships: actor.relationships })),
    actions: simulation.interactions.filter(action => action.roundIndex === roundIndex).map(action => ({
      actor: action.sourceActorId, targets: action.targetActorIds, action: action.actionType,
      visibility: action.visibility, decision: action.decisionType, content: text(action.content), intent: text(action.intent),
    })),
  })
}

export function selectProgressDecision(value: string): string | undefined {
  const selected = value.trim()
  return selected === "1" || selected === "0" ? selected : undefined
}
