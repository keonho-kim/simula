"""목적:
- 최종 보고서의 주요 사건과 그 결과 섹션을 작성한다.

설명:
- 분기점이 된 활동과 그 결과를 연결해 설명한다.

사용한 설계 패턴:
- 단일 섹션 작성 노드 패턴
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.utils.finalization_sections import (
    build_report_prompt_inputs,
    prepend_subheading,
    validate_bullet_section,
    write_report_section,
)
from simula.application.workflow.graphs.finalization.prompts.major_events_prompt import (
    PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

SECTION_TITLE = "주요 사건과 그 결과"


async def write_major_events_section(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """주요 사건과 그 결과 본문을 작성한다."""

    section_body = await write_report_section(
        runtime=runtime,
        prompt=PROMPT,
        prompt_inputs=build_report_prompt_inputs(
            state,
            include_body_sections=False,
        ),
        section_title=SECTION_TITLE,
        validator=lambda body: validate_bullet_section(
            body,
            min_items=1,
        ),
    )
    return {
        "report_major_events_section": prepend_subheading(
            subheading="분기점 사건",
            body=section_body,
        )
    }
