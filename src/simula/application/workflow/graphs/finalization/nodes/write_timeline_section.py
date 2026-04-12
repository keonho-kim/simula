"""목적:
- 최종 보고서의 시뮬레이션 타임라인 섹션을 작성한다.

설명:
- 정제된 step packet을 바탕으로 절대시각 bullet 타임라인을 쓴다.

사용한 설계 패턴:
- 단일 섹션 작성 노드 패턴
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.utils.finalization_sections import (
    build_report_prompt_inputs,
    prepend_subheading,
    validate_timeline_section,
    write_report_section,
)
from simula.application.workflow.graphs.finalization.prompts.timeline_report_prompt import (
    PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

SECTION_TITLE = "시뮬레이션 타임라인"


async def write_timeline_section(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """타임라인 본문을 작성한다."""

    section_body = await write_report_section(
        runtime=runtime,
        prompt=PROMPT,
        prompt_inputs=build_report_prompt_inputs(
            state,
            include_body_sections=False,
        ),
        section_title=SECTION_TITLE,
        validator=validate_timeline_section,
    )
    return {
        "report_timeline_section": prepend_subheading(
            subheading="전체 흐름",
            body=section_body,
        )
    }
