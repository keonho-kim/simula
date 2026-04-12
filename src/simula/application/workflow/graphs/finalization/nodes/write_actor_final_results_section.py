"""목적:
- 최종 보고서의 행위자 별 최종 결과 섹션을 작성한다.

설명:
- 본론 전체를 읽은 뒤 표 본문 행만 생성하고, 헤더는 코드에서 고정한다.

사용한 설계 패턴:
- 단일 섹션 작성 노드 패턴
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.utils.finalization_sections import (
    build_report_prompt_inputs,
    prepend_subheading,
    render_markdown_table,
    validate_markdown_table_rows,
    write_report_section,
)
from simula.application.workflow.graphs.finalization.prompts.actor_final_results_prompt import (
    PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

SECTION_TITLE = "행위자 별 최종 결과"
_HEADERS = ["주체", "최종 결론", "상대/대상", "유불리/상태", "근거 요약"]


async def write_actor_final_results_section(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """행위자 최종 결과 표를 작성한다."""

    actor_count = len(list(state.get("actors", [])))
    row_max = max(1, actor_count if actor_count <= 16 else 11)
    table_rows = await write_report_section(
        runtime=runtime,
        prompt=PROMPT,
        prompt_inputs=build_report_prompt_inputs(
            state,
            include_body_sections=True,
        ),
        section_title=SECTION_TITLE,
        validator=lambda body: validate_markdown_table_rows(
            body,
            min_rows=1,
            max_rows=row_max,
        ),
    )
    return {
        "report_actor_final_results_section": prepend_subheading(
            subheading="최종 결과 표",
            body=render_markdown_table(
                headers=_HEADERS,
                section_body=table_rows,
            ),
        )
    }
