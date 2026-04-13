"""Purpose:
- Write all final report sections in one structured bundle.
"""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.finalization.output_schema.bundles import (
    build_final_report_sections_prompt_bundle,
)
from simula.application.workflow.graphs.finalization.prompts.write_final_report_bundle_prompt import (
    PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.finalization_sections import (
    validate_actor_dynamics_section,
    validate_bullet_section,
    validate_conclusion_section,
    validate_forbidden_report_terms,
    validate_markdown_table_rows,
    validate_timeline_section,
)
from simula.domain.contracts import FinalReportSections


async def write_final_report_bundle(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Write the full final report bundle with one LLM call and one retry."""

    feedback = ""
    errors = list(state["errors"])
    actor_count = len(list(state["actors"]))
    row_max = max(1, actor_count if actor_count <= 16 else 11)
    for attempt in range(2):
        prompt = PROMPT.format(
            scenario_text=state["scenario"],
            final_report_json=json.dumps(
                state["final_report"],
                ensure_ascii=False,
                indent=2,
            ),
            report_projection_json=state["report_projection_json"],
            **build_final_report_sections_prompt_bundle(),
        )
        if feedback:
            prompt += (
                "\n\n# Retry Notice\n"
                f"- The previous output failed validation: {feedback}\n"
                "- Rewrite the entire JSON object from scratch.\n"
            )
        sections, meta = await runtime.context.llms.ainvoke_structured_with_meta(
            "observer",
            prompt,
            FinalReportSections,
            log_context={
                "scope": "final-report",
                "section": "bundle",
                "attempt": attempt + 1,
            },
        )
        dumped = sections.model_dump(mode="json")
        feedback = _validate_sections(
            sections=dumped,
            scenario_text=state["scenario"],
            row_max=row_max,
        )
        if feedback == "":
            if meta.forced_default:
                errors.append("final report bundle defaulted")
            return {"final_report_sections": dumped, "errors": errors}

    raise ValueError(f"최종 보고서 bundle 형식 검증에 실패했습니다: {feedback}")


def _validate_sections(
    *,
    sections: dict[str, object],
    scenario_text: str,
    row_max: int,
) -> str:
    validators = [
        validate_conclusion_section(str(sections.get("conclusion_section", ""))),
        validate_markdown_table_rows(
            str(sections.get("actor_results_rows", "")),
            min_rows=1,
            max_rows=row_max,
        ),
        validate_timeline_section(str(sections.get("timeline_section", ""))),
        validate_actor_dynamics_section(str(sections.get("actor_dynamics_section", ""))),
        validate_bullet_section(str(sections.get("major_events_section", "")), min_items=1),
    ]
    for candidate in validators:
        if candidate is not None:
            return candidate
    for field_name in (
        "conclusion_section",
        "actor_results_rows",
        "timeline_section",
        "actor_dynamics_section",
        "major_events_section",
    ):
        violation = validate_forbidden_report_terms(
            str(sections.get(field_name, "")),
            scenario_text=scenario_text,
        )
        if violation is not None:
            return violation
    return ""
