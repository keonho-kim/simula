/**
 * Purpose: Define the role prompt builder contract.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/coordinator/prompts/index.ts
 */
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import type { CoordinatorTraceStep } from "@/shared"

export type CoordinatorPromptBuilder = (
  state: WorkflowState,
  partial: Partial<Record<CoordinatorTraceStep, string>>
) => string
