import type { RoleTrace, RoleTraceStep } from "@/shared"
import { upsertRoleTrace, type WorkflowState } from "@/backend/core/simulation/workflow/state"

import { runPlainTextNode } from "@/backend/core/simulation/roles/shared/node"
import { getRoleTrace, tracePartial } from "@/backend/core/simulation/roles/shared/state"
import type { RoleGraphOptions } from "@/backend/core/simulation/roles/shared/types"

export function createRoleStepNode(
  options: RoleGraphOptions,
  step: RoleTraceStep
): (state: WorkflowState) => Promise<Partial<WorkflowState>> {
  return async (state) => {
    const currentTrace = getRoleTrace(state, options.role)
    const partial = tracePartial(currentTrace)
    const result = await runPlainTextNode(state, options.role, step, options.prompts[step], partial, options.emit)
    const nextTrace: RoleTrace = {
      ...currentTrace,
      [step]: result.text,
      retryCounts: {
        ...currentTrace.retryCounts,
        [step]: result.retries,
      },
    }

    return {
      simulation: upsertRoleTrace(state.simulation, nextTrace),
    }
  }
}
