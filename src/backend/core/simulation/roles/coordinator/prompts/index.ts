/**
 * Purpose: Select the prompt builder for each role workflow step.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/coordinator/graph.ts
 */
import type { CoordinatorTraceStep } from "@/shared"
import { actorRouting } from "./actor-routing"
import type { CoordinatorPromptBuilder } from "./contracts"
import { eventInjection } from "./event-injection"
import { eventResolution } from "./event-resolution"
import { interactionPolicy } from "./interaction-policy"
import { outcomeDirection } from "./outcome-direction"
import { runtimeFrame } from "./runtime-frame"
export type { CoordinatorPromptBuilder } from "./contracts"

export const coordinatorPrompts: Record<Exclude<CoordinatorTraceStep, "progressDecision">, CoordinatorPromptBuilder> = {
  runtimeFrame,
  actorRouting,
  interactionPolicy,
  outcomeDirection,
  eventInjection,
  eventResolution,
}
