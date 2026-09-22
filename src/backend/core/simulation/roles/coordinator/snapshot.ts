/**
 * Purpose: Build immutable coordinator workflow views from round-owned state.
 * Pattern: Projection.
 * Usage: Imported by coordinator nodes before model and observer calls.
 * Related: src/backend/core/simulation/roles/coordinator/nodes.ts
 */
import type {
  ActorState,
  CoordinatorTrace,
  Interaction,
  PlannedEvent,
  RoleTrace,
  RoundDigest,
  RoundReport,
} from "@/shared"
import { summarizeEvents, summarizeInteractions } from "@/backend/core/simulation/outputs/report"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"

export interface CoordinatorRoundState {
  actors: ActorState[]
  interactions: Interaction[]
  roundDigests: RoundDigest[]
  roundReports: RoundReport[]
  roleTraces: RoleTrace[]
  coordinatorTrace: CoordinatorTrace
  events: PlannedEvent[]
}

export function coordinatorSnapshot(
  state: WorkflowState,
  round: CoordinatorRoundState
): WorkflowState {
  return {
    ...state,
    simulation: {
      ...state.simulation,
      actors: round.actors,
      interactions: round.interactions,
      roundDigests: round.roundDigests,
      roundReports: round.roundReports,
      roleTraces: [
        ...round.roleTraces.filter((trace) => trace.role !== "coordinator"),
        round.coordinatorTrace,
      ],
      plan: state.simulation.plan
        ? { ...state.simulation.plan, majorEvents: round.events }
        : state.simulation.plan,
      worldSummary: `${summarizeInteractions(round.interactions)} ${summarizeEvents(round.events)}`,
    },
  }
}
