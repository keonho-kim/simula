/**
 * Purpose: Define the role prompt builder contract.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/planner/prompts/index.ts
 */
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import type { PlannerTraceStep } from "@/shared"

export type PlannerPromptBuilder = (
  state: WorkflowState,
  partial: Partial<Record<PlannerTraceStep, string>>
) => string
