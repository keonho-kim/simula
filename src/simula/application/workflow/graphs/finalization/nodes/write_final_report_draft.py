"""Single-call final report draft node."""

from __future__ import annotations

import json
from typing import cast

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.finalization.prompts.final_report_draft_prompt import (
    FINAL_REPORT_DRAFT_EXAMPLE,
    PROMPT as FINAL_REPORT_DRAFT_PROMPT,
)
from simula.application.workflow.graphs.finalization.utils.sections import (
    normalize_actor_dynamics_section,
    normalize_bullet_only_section,
    normalize_conclusion_section,
    validate_timeline_section,
)
from simula.application.workflow.graphs.finalization.utils.final_report_draft import (
    render_timeline_section,
    validate_final_report_draft,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import FinalReportDraft
from simula.shared.logging.llm import build_llm_log_context
from simula.shared.prompts.output_schema_utils import object_prompt_bundle


async def write_final_report_draft(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Write all final report prose in one LLM call."""

    report_projection = json.loads(str(state.get("report_projection_json") or "{}"))
    final_report = cast(dict[str, object], state["final_report"])
    compact_input = {
        "scenario_text": str(state["scenario"])[:1600],
        "final_report": final_report,
        "report_projection": report_projection,
    }
    prompt = FINAL_REPORT_DRAFT_PROMPT.format(
        compact_input_json=json.dumps(
            compact_input,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **object_prompt_bundle(
            example=FINAL_REPORT_DRAFT_EXAMPLE,
            example_mode="compact",
        ),
    )
    draft, meta = await runtime.context.llms.ainvoke_object_with_meta(
        "observer",
        prompt,
        FinalReportDraft,
        failure_policy="fixer",
        semantic_validator=validate_final_report_draft,
        log_context=build_llm_log_context(
            scope="final-report",
            phase="finalization",
            task_key="final_report_draft",
            task_label="최종 보고서 초안 작성",
            artifact_key="final_report_sections",
            artifact_label="final_report_sections",
            schema=FinalReportDraft,
        ),
    )
    timeline_section = render_timeline_section(
        report_projection=report_projection,
        final_report=final_report,
    )
    timeline_error = validate_timeline_section(timeline_section)
    if timeline_error is not None:
        raise ValueError(f"deterministic timeline rendering failed: {timeline_error}")
    sections = {
        "conclusion_section": normalize_conclusion_section(draft.conclusion_section),
        "timeline_section": timeline_section,
        "actor_dynamics_section": normalize_actor_dynamics_section(
            draft.actor_dynamics_section
        ),
        "major_events_section": normalize_bullet_only_section(
            draft.major_events_section
        ),
    }
    runtime.context.logger.info(
        "최종 보고서 draft 완료 | 1 call | %.2fs",
        meta.duration_seconds,
    )
    runtime.context.logger.debug(
        "최종 보고서 draft 결과\nLLM: %.2fs | in=%s out=%s total=%s | fixer=%s",
        meta.duration_seconds,
        meta.input_tokens,
        meta.output_tokens,
        meta.total_tokens,
        meta.fixer_used,
    )
    return {
        "report_conclusion_section": sections["conclusion_section"],
        "report_timeline_section": sections["timeline_section"],
        "report_actor_dynamics_section": sections["actor_dynamics_section"],
        "report_major_events_section": sections["major_events_section"],
        "final_report_sections": {
            **sections,
            "actor_results_rows": "",
        },
    }
