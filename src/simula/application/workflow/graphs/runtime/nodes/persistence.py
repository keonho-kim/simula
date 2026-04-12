"""목적:
- runtime 계산 결과를 저장소에 반영하는 persistence node를 제공한다.

설명:
- step activity와 observer 리포트 저장을 계산 node와 분리한다.

사용한 설계 패턴:
- explicit persistence node 패턴
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def persist_step_artifacts(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """step activity와 observer 리포트를 함께 저장한다."""

    observer_report = state.get("pending_observer_report")
    if observer_report is None:
        return {}

    runtime.context.store.save_step_artifacts(
        state["run_id"],
        activities=list(state.get("latest_step_activities", [])),
        observer_report=observer_report,
    )
    return {"pending_observer_report": None}
