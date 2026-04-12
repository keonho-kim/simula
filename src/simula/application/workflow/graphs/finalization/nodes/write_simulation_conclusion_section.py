"""목적:
- 최종 보고서의 시뮬레이션 결론 섹션을 작성한다.

설명:
- 본문과 행위자 최종 결과를 읽은 뒤 최상단 bullet 결론을 만든다.

사용한 설계 패턴:
- 후행 종합 섹션 작성 노드 패턴
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.utils.finalization_sections import (
    build_report_prompt_inputs,
    validate_conclusion_section,
    write_report_section,
)
from simula.application.workflow.graphs.finalization.prompts.simulation_conclusion_prompt import (
    PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

SECTION_TITLE = "시뮬레이션 결론"


async def write_simulation_conclusion_section(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """시뮬레이션 결론 bullet을 작성한다."""

    section_body = await write_report_section(
        runtime=runtime,
        prompt=PROMPT,
        prompt_inputs=build_report_prompt_inputs(
            state,
            include_body_sections=True,
            include_actor_final_results=True,
        ),
        section_title=SECTION_TITLE,
        validator=validate_conclusion_section,
    )
    return {"report_simulation_conclusion_section": section_body}
