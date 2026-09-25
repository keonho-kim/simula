/**
 * Purpose: Select the prompt builder for each role workflow step.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/planner/graph.ts
 */
import type { PlannerTraceStep } from "@/shared"
import { actorPressures } from "./actor-pressures"
import { conflictDynamics } from "./conflict-dynamics"
import type { PlannerPromptBuilder } from "./contracts"
import { coreSituation } from "./core-situation"
import { majorEvents } from "./major-events"
import { simulationDirection } from "./simulation-direction"
export type { PlannerPromptBuilder } from "./contracts"

export const plannerPrompts: Record<PlannerTraceStep, PlannerPromptBuilder> = {
  coreSituation,
  actorPressures,
  conflictDynamics,
  simulationDirection,
  majorEvents,
}
