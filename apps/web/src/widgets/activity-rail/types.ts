import type {
  CoordinatorTraceStep,
  ModelMetrics,
  ModelRole,
  PlannerTraceStep,
  RoleTrace,
  RoleTraceStep,
} from "@simula/shared"

export const ROLE_BUTTONS: RolePanelRole[] = ["planner", "generator", "coordinator", "observer", "repair"]
export const STANDARD_TRACE_STEPS: RoleTraceStep[] = ["thought", "target", "action", "intent"]
export const PLANNER_TRACE_STEPS: PlannerTraceStep[] = [
  "coreSituation",
  "actorPressures",
  "conflictDynamics",
  "simulationDirection",
  "majorEvents",
]
export const COORDINATOR_TRACE_STEPS: CoordinatorTraceStep[] = [
  "runtimeFrame",
  "actorRouting",
  "interactionPolicy",
  "outcomeDirection",
  "eventInjection",
  "progressDecision",
  "extensionDecision",
]

export type TraceStep = RoleTraceStep | PlannerTraceStep | CoordinatorTraceStep

export interface TraceEntry {
  step: string
  label: string
  content: string
}

export type RolePanelRole = Exclude<ModelRole, "storyBuilder" | "actor">
export type RoleStatus = "idle" | "active" | "running" | "done" | "failed"

export interface LogItem {
  id: string
  level: "info" | "warn" | "error"
  title: string
  body: string
  timestamp: string
}

export interface RoleSummary {
  role: RolePanelRole
  label: string
  description: string
  status: RoleStatus
  preview: string
  trace?: RoleTrace
  messages: Array<{ content: string; timestamp: string }>
  sections: TraceEntry[]
  metrics: ModelMetrics[]
  logs: LogItem[]
}
