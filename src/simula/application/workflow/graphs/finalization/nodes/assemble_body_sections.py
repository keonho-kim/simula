"""목적:
- 섹션별 본론 결과를 하나로 모은다.

설명:
- 병렬로 작성된 본론 세 개를 고정 순서로 정렬해 markdown 본문으로 조립한다.

사용한 설계 패턴:
- fan-in 조립 노드 패턴
"""

from __future__ import annotations

from simula.application.workflow.utils.finalization_sections import (
    assemble_body_sections_markdown,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def assemble_body_sections(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    """본론 섹션들을 조립한다."""

    report_body_sections = [
        {
            "title": "시뮬레이션 타임라인",
            "body": str(state["report_timeline_section"]).strip(),
        },
        {
            "title": "행위자 역학 관계",
            "body": str(state["report_actor_dynamics_section"]).strip(),
        },
        {
            "title": "주요 사건과 그 결과",
            "body": str(state["report_major_events_section"]).strip(),
        },
    ]
    return {
        "report_body_sections": report_body_sections,
        "report_body_sections_markdown": assemble_body_sections_markdown(
            report_body_sections
        ),
    }
