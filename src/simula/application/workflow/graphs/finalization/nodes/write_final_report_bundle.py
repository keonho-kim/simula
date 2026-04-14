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
    normalize_final_report_sections,
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
                f"{_build_retry_guidance(feedback)}\n"
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
        dumped = normalize_final_report_sections(sections.model_dump(mode="json"))
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


def _build_retry_guidance(feedback: str) -> str:
    if "### 최종 상태" in feedback or "### 핵심 판단 근거" in feedback:
        return (
            "- Use this exact shape for `conclusion_section`:\n"
            "  ### 최종 상태\n"
            "  - 첫 번째 상태 요약\n"
            "  - 두 번째 상태 요약\n"
            "  ### 핵심 판단 근거\n"
            "  - 첫 번째 근거\n"
            "  - 두 번째 근거"
        )
    if "표 본문" in feedback:
        return (
            "- `actor_results_rows` must contain body rows only, for example:\n"
            "  | A | 결과 | B | 우세 | 근거 |"
        )
    if "타임라인" in feedback:
        return (
            "- `timeline_section` must use bullet rows like:\n"
            "  - 2027-06-18 03:20 | 시작 단계 | 사건 | 결과"
        )
    if "bullet" in feedback or "'- '" in feedback:
        return (
            "- Every non-empty line in the affected field must begin with '- '."
        )
    return "- Rewrite every field to match the schema and the exact markdown format rules."
