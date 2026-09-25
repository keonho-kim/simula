/**
 * Purpose: Build the planner major-events model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/planner/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { PlannerPromptBuilder } from "./contracts"

export const majorEvents: PlannerPromptBuilder = (current, partial) =>
    `Planner majorEvents.
List concrete major events that could occur during this scenario and create new pressure for actors.
For each event summary, explicitly name who first observes or receives the event and whether it is public. A participant mentioned in the event is not automatically a recipient.
Return one event per line in exactly this format: Title - Summary
Do not include headings, markdown tables, code fences, or commentary.
Create only the requested number of events. Each event must fit in one line.

${renderPromptBlock("CONSTRAINTS", `Requested events: ${current.scenario.controls.autonomousProgress
  ? Math.max(3, current.scenario.controls.maxRound ?? 8) : current.scenario.controls.maxRound ?? 8}`)}

${renderPromptBlock("PREVIOUS_RESULT", `Core situation: ${partial.coreSituation}
Actor pressures: ${partial.actorPressures}
Conflict dynamics: ${partial.conflictDynamics}
Simulation direction: ${partial.simulationDirection}`)}`
