"""목적:
- generation 결과 저장 노드를 제공한다.

설명:
- 생성된 actor 목록을 저장소에 반영하고 pending 채널을 비운다.

사용한 설계 패턴:
- persistence node 패턴
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def persist_generated_actors(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """생성된 actor 목록을 저장한다."""

    pending_actors = list(state.get("pending_actors", []))
    if pending_actors:
        runtime.context.store.save_actors(state["run_id"], pending_actors)
    return {"pending_actors": []}
