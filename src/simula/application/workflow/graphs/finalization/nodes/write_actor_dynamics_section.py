"""목적:
- 최종 보고서의 행위자 역학 관계 섹션을 작성한다.

설명:
- 행위자 사이의 현재 구도와 관계 변화를 압축 분석한다.

사용한 설계 패턴:
- 단일 섹션 작성 노드 패턴
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.utils.finalization_sections import (
    build_report_prompt_inputs,
    validate_actor_dynamics_section,
    write_report_section,
)
from simula.application.workflow.graphs.finalization.prompts.actor_dynamics_prompt import (
    PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

SECTION_TITLE = "행위자 역학 관계"


async def write_actor_dynamics_section(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """행위자 역학 관계 본문을 작성한다."""

    section_body = await write_report_section(
        runtime=runtime,
        prompt=PROMPT,
        prompt_inputs=build_report_prompt_inputs(
            state,
            include_body_sections=False,
        ),
        section_title=SECTION_TITLE,
        validator=validate_actor_dynamics_section,
    )
    return {"report_actor_dynamics_section": section_body}
