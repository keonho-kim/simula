"""목적:
- 최종 보고서 JSON을 저장한다.

설명:
- markdown 출력과 별개로 구조화된 최종 요약 JSON을 저장소에 기록한다.

사용한 설계 패턴:
- 저장 노드 패턴
"""

from __future__ import annotations

from typing import cast

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def persist_final_report(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """최종 리포트를 저장한다."""

    runtime.context.store.save_final_report(
        state["run_id"],
        cast(dict[str, object], state["final_report"]),
    )
    runtime.context.logger.info("최종 정리 완료")
    return {}
