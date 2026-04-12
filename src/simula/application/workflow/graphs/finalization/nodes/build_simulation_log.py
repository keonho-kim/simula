"""목적:
- 최종 실행 로그 JSONL 문자열을 만든다.

설명:
- final_report가 조립된 뒤 전체 상태를 simulation.log.jsonl 형식으로 렌더링한다.

사용한 설계 패턴:
- 순수 조립 노드 패턴
"""

from __future__ import annotations

import json
from typing import cast

from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.reporting import build_simulation_log_entries


def build_simulation_log(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    """시뮬레이션 로그 JSONL 문자열을 만든다."""

    simulation_log_entries = build_simulation_log_entries(
        {
            **cast(dict[str, object], state),
            "final_report": state["final_report"],
        }
    )
    return {
        "simulation_log_jsonl": "\n".join(
            json.dumps(entry, ensure_ascii=False) for entry in simulation_log_entries
        )
    }
