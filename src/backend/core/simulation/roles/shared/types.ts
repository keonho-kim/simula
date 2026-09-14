import type { RoleTraceStep, RunEvent, SimulationRole } from "@/shared"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"

export type PromptBuilder = (state: WorkflowState, partial: Partial<Record<RoleTraceStep, string>>) => string

export interface RoleGraphOptions {
  role: Exclude<SimulationRole, "planner" | "coordinator" | "observer">
  prompts: Record<RoleTraceStep, PromptBuilder>
  emit: (event: RunEvent) => Promise<void>
}
