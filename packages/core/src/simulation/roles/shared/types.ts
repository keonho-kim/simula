import type { RoleTraceStep, RunEvent, SimulationRole } from "@simula/shared"
import type { WorkflowState } from "../../state"

export type PromptBuilder = (state: WorkflowState, partial: Partial<Record<RoleTraceStep, string>>) => string

export interface RoleGraphOptions {
  role: Exclude<SimulationRole, "planner" | "coordinator">
  prompts: Record<RoleTraceStep, PromptBuilder>
  emit: (event: RunEvent) => Promise<void>
}
