import type { PlannerTraceStep } from "@simula/shared"
import type { WorkflowState } from "../../state"

export type PlannerPromptBuilder = (
  state: WorkflowState,
  partial: Partial<Record<PlannerTraceStep, string>>
) => string

export const plannerPrompts: Record<PlannerTraceStep, PlannerPromptBuilder> = {
  coreSituation: (current) =>
    `Planner coreSituation.
Summarize the scenario's factual situation, setting, triggering pressure, and end condition in one compact paragraph.
Do not introduce actors that are not implied by the scenario.
Return only the digest body. Do not include labels, headings, markdown, bullets, or prefixes.

Scenario: ${current.scenario.text}`,
  actorPressures: (_current, partial) =>
    `Planner actorPressures.
Summarize the main pressures, incentives, constraints, and asymmetries that different actors will feel.
Write one compact paragraph that downstream actor generation can reuse.
Return only the digest body. Do not include labels, headings, markdown, bullets, or prefixes.

Core situation digest: ${partial.coreSituation}`,
  conflictDynamics: (_current, partial) =>
    `Planner conflictDynamics.
Summarize how actor pressures are likely to collide through public, semi-public, private, and solitary actions.
Write one compact paragraph focused on interaction dynamics, not prose backstory.
Return only the digest body. Do not include labels, headings, markdown, bullets, or prefixes.

Actor pressure digest: ${partial.actorPressures}`,
  simulationDirection: (_current, partial) =>
    `Planner simulationDirection.
Summarize what the simulation should explore across rounds and what kind of resolution would count as meaningful.
Write one compact paragraph that Coordinator and Actor roles can use as shared direction.
Return only the digest body. Do not include labels, headings, markdown, bullets, or prefixes.

Conflict dynamics digest: ${partial.conflictDynamics}`,
  majorEvents: (current, partial) =>
    `Planner majorEvents.
List concrete major events that could occur during this scenario and create new pressure for actors.
Return one event per line in exactly this format: Title - Summary
Do not include headings, markdown tables, code fences, or commentary.
Create at least 3 events and enough events to support the requested max rounds.

Max rounds: ${current.scenario.controls.maxRound ?? 8}
Core situation: ${partial.coreSituation}
Actor pressures: ${partial.actorPressures}
Conflict dynamics: ${partial.conflictDynamics}
Simulation direction: ${partial.simulationDirection}`,
}
