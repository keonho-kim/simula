"""목적:
- 최종 보고서 JSON 초안을 만든다.

설명:
- runtime 전체 상태를 바탕으로 최종 집계용 JSON 보고서를 조립한다.

사용한 설계 패턴:
- 순수 조립 노드 패턴
"""

from __future__ import annotations

from typing import cast

from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.reporting import build_final_report


def build_final_report_payload(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    """최종 요약 JSON을 만든다."""

    final_report = build_final_report(cast(dict[str, object], state))
    return {"final_report": final_report}
