"""목적:
- planning 결과 저장 노드를 제공한다.

설명:
- planner 결과를 저장소에 반영하고 pending 채널을 비운다.

사용한 설계 패턴:
- persistence node 패턴
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def persist_plan(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """planner 결과를 저장한다."""

    pending_plan = state.get("pending_plan")
    if pending_plan is not None:
        runtime.context.store.save_plan(state["run_id"], pending_plan)
    return {"pending_plan": None}
