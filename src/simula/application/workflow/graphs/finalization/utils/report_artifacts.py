"""Final report artifact helpers."""

from __future__ import annotations

from datetime import datetime

from simula.application.workflow.graphs.finalization.utils.timeline_anchor import (
    extract_explicit_anchor,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def timeline_anchor(state: SimulationWorkflowState) -> dict[str, object]:
    explicit_anchor = extract_explicit_anchor(str(state["scenario"]))
    if explicit_anchor is None:
        explicit_anchor = datetime(2000, 1, 1, 9, 0, 0)
        reason = "시나리오에 절대 날짜와 시각이 없어 deterministic default anchor를 사용했다."
    else:
        reason = "시나리오 본문에 절대 날짜와 시각이 명시되어 있어 이를 시작 anchor로 사용했다."
    return {
        "anchor_iso": explicit_anchor.isoformat(timespec="seconds"),
        "reason": reason,
    }
