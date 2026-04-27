"""Build the runtime coordination policy."""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.prompts.coordination_frame_prompt import (
    COORDINATION_FRAME_EXAMPLE,
    PROMPT as COORDINATION_FRAME_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import CoordinationFrame
from simula.shared.logging.llm import build_llm_log_context
from simula.shared.prompts.output_schema_utils import object_prompt_bundle


async def build_coordination_frame(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the runtime coordination policy."""

    planning_analysis_json = json.dumps(
        state["planning_analysis"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    cast_roster_outline_json = json.dumps(
        state["cast_roster_outline"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    coordination_frame_prompt = COORDINATION_FRAME_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=planning_analysis_json,
        cast_roster_outline_json=cast_roster_outline_json,
        situation_json=json.dumps(
            state["situation"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        action_catalog_json=json.dumps(
            state["action_catalog"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **object_prompt_bundle(example=COORDINATION_FRAME_EXAMPLE),
    )
    coordination_frame, _meta = (
        await runtime.context.llms.ainvoke_object_with_meta(
            "planner",
            coordination_frame_prompt,
            CoordinationFrame,
            log_context=build_llm_log_context(
                scope="planning-coordination-frame",
                phase="planning",
                task_key="execution_plan_coordination_frame",
                task_label="조율 기준 정리",
                artifact_key="coordination_frame",
                artifact_label="coordination_frame",
                schema=CoordinationFrame,
            ),
        )
    )
    return {"coordination_frame": coordination_frame.model_dump(mode="json")}
