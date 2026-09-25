/**
 * Purpose: Define the role prompt builder contract.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/observer/prompts/index.ts
 */
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"

export type ObserverPromptBuilder = (state: WorkflowState) => string
