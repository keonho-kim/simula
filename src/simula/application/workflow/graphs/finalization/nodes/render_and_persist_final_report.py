"""Purpose:
- Render the final markdown report and persist the final report payload.
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.reporting import render_llm_usage_lines


def render_and_persist_final_report(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Render the final markdown report and persist the final report JSON."""

    sections = {
        "conclusion_section": str(state.get("report_conclusion_section", "")).strip(),
        "actor_results_rows": "",
        "timeline_section": str(state.get("report_timeline_section", "")).strip(),
        "actor_dynamics_section": str(
            state.get("report_actor_dynamics_section", "")
        ).strip(),
        "major_events_section": str(state.get("report_major_events_section", "")).strip(),
    }
    rendered_sections = [
        "## LLM 사용 요약\n\n"
        + "\n".join(
            f"- {line}" for line in render_llm_usage_lines(state["llm_usage_summary"])
        ),
        f"## 시뮬레이션 결론\n\n{str(sections['conclusion_section']).strip()}".strip(),
        f"## 시뮬레이션 타임라인\n\n### 전체 흐름\n\n{str(sections['timeline_section']).strip()}".strip(),
        f"## 행위자 역학 관계\n\n{str(sections['actor_dynamics_section']).strip()}".strip(),
        f"## 주요 사건과 그 결과\n\n### 분기점 사건\n\n{str(sections['major_events_section']).strip()}".strip(),
    ]
    final_report_markdown = "# 시뮬레이션 결과\n\n" + "\n\n".join(rendered_sections)
    runtime.context.store.save_final_report(state["run_id"], state["final_report"])
    runtime.context.logger.info("최종 정리 완료")
    return {
        "final_report_sections": sections,
        "final_report_markdown": final_report_markdown,
    }
