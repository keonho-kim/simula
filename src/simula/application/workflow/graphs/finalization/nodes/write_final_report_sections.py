"""Purpose:
- Write the final report sections in parallel using shared compact inputs.
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.finalization.prompts.write_actor_dynamics_section_prompt import (
    PROMPT as ACTOR_DYNAMICS_PROMPT,
)
from simula.application.workflow.graphs.finalization.prompts.write_conclusion_section_prompt import (
    PROMPT as CONCLUSION_PROMPT,
)
from simula.application.workflow.graphs.finalization.prompts.write_major_events_section_prompt import (
    PROMPT as MAJOR_EVENTS_PROMPT,
)
from simula.application.workflow.graphs.finalization.prompts.write_timeline_section_prompt import (
    PROMPT as TIMELINE_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.finalization_sections import (
    build_report_prompt_inputs,
    normalize_actor_dynamics_section,
    normalize_bullet_only_section,
    normalize_conclusion_section,
    normalize_timeline_section,
    validate_actor_dynamics_section,
    validate_bullet_section,
    validate_conclusion_section,
    validate_timeline_section,
    write_report_section,
)


async def write_conclusion_section(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Write the conclusion section."""

    section_body = await write_report_section(
        runtime=runtime,
        prompt=CONCLUSION_PROMPT,
        prompt_inputs=build_report_prompt_inputs(state),
        section_title="conclusion",
        task_key="final_report_section.conclusion",
        task_label="결론 섹션 작성",
        artifact_key="report_conclusion_section",
        validator=validate_conclusion_section,
        normalizer=normalize_conclusion_section,
    )
    return {"report_conclusion_section": section_body}


async def write_timeline_section(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Write the timeline section."""

    section_body = await write_report_section(
        runtime=runtime,
        prompt=TIMELINE_PROMPT,
        prompt_inputs=build_report_prompt_inputs(state),
        section_title="timeline",
        task_key="final_report_section.timeline",
        task_label="타임라인 섹션 작성",
        artifact_key="report_timeline_section",
        validator=validate_timeline_section,
        normalizer=normalize_timeline_section,
    )
    return {"report_timeline_section": section_body}


async def write_actor_dynamics_section(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Write the actor dynamics section."""

    section_body = await write_report_section(
        runtime=runtime,
        prompt=ACTOR_DYNAMICS_PROMPT,
        prompt_inputs=build_report_prompt_inputs(state),
        section_title="actor-dynamics",
        task_key="final_report_section.actor_dynamics",
        task_label="행위자 역학 섹션 작성",
        artifact_key="report_actor_dynamics_section",
        validator=validate_actor_dynamics_section,
        normalizer=normalize_actor_dynamics_section,
    )
    return {"report_actor_dynamics_section": section_body}


async def write_major_events_section(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Write the major events section."""

    section_body = await write_report_section(
        runtime=runtime,
        prompt=MAJOR_EVENTS_PROMPT,
        prompt_inputs=build_report_prompt_inputs(state),
        section_title="major-events",
        task_key="final_report_section.major_events",
        task_label="주요 이벤트 섹션 작성",
        artifact_key="report_major_events_section",
        validator=lambda body: validate_bullet_section(body, min_items=1, max_items=5),
        normalizer=normalize_bullet_only_section,
    )
    return {"report_major_events_section": section_body}
