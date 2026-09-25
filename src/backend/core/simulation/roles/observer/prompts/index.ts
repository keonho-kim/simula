/**
 * Purpose: Select the prompt builder for each role workflow step.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/observer/nodes.ts
 */
import type { ObserverTraceStep } from "@/shared"
import type { ObserverPromptBuilder } from "./contracts"
import { roundSummary } from "./round-summary"
export type { ObserverPromptBuilder } from "./contracts"

export const observerPrompts: Record<ObserverTraceStep, ObserverPromptBuilder> = {
  roundSummary,
}
