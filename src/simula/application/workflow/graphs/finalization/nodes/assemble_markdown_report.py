"""목적:
- 최종 보고서 markdown 본문을 조립한다.

설명:
- 결론, 행위자 결과 표, 본론 세 섹션을 하나의 markdown 문서로 만든다.

사용한 설계 패턴:
- 최종 렌더링 노드 패턴
"""

from __future__ import annotations

from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def assemble_markdown_report(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    """최종 markdown 보고서를 조립한다."""

    rendered_sections = [
        f"## 시뮬레이션 결론\n\n{str(state['report_simulation_conclusion_section']).strip()}".strip(),
        f"## 행위자 별 최종 결과\n\n{str(state['report_actor_final_results_section']).strip()}".strip(),
        *[
            f"## {section['title']}\n\n{section['body']}".strip()
            for section in list(state.get("report_body_sections", []))
        ],
    ]
    return {
        "final_report_markdown": "# 시뮬레이션 결과\n\n"
        + "\n\n".join(rendered_sections)
    }
