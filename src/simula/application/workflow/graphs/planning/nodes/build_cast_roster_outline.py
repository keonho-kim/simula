"""Build the compact cast roster outline."""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.prompts.cast_roster_outline_prompt import (
    CAST_ROSTER_OUTLINE_ITEM_EXAMPLE,
    PROMPT as CAST_ROSTER_OUTLINE_PROMPT,
    cast_roster_policy_text,
)
from simula.application.workflow.graphs.planning.utils.validation import (
    build_cast_roster_outline_repair_context,
    validate_cast_roster_outline_semantics,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import CastRosterOutlineItem
from simula.shared.logging.llm import build_llm_log_context
from simula.shared.prompts.output_schema_utils import simple_array_prompt_bundle


async def build_cast_roster_outline(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the compact cast outline before chunk expansion."""

    prompt = CAST_ROSTER_OUTLINE_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=json.dumps(
            state["planning_analysis"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        num_cast=state["scenario_controls"]["num_cast"],
        allow_additional_cast=str(
            state["scenario_controls"]["allow_additional_cast"]
        ).lower(),
        cast_roster_policy=cast_roster_policy_text(
            num_cast=state["scenario_controls"]["num_cast"],
            allow_additional_cast=state["scenario_controls"][
                "allow_additional_cast"
            ],
        ),
        **simple_array_prompt_bundle(
            example_item=CAST_ROSTER_OUTLINE_ITEM_EXAMPLE,
        ),
    )
    outline_items, meta = await runtime.context.llms.ainvoke_simple_with_meta(
        "planner",
        prompt,
        list[CastRosterOutlineItem],
        failure_policy="fixer",
        repair_context=build_cast_roster_outline_repair_context(
            num_cast=int(state["scenario_controls"]["num_cast"]),
            allow_additional_cast=bool(
                state["scenario_controls"]["allow_additional_cast"]
            ),
        ),
        log_context=build_llm_log_context(
            scope="cast-roster-outline",
            phase="planning",
            task_key="cast_roster_outline",
            task_label="등장 인물 개요 정리",
            artifact_key="cast_roster_outline",
            artifact_label="cast_roster_outline",
            contract_kind="simple",
            output_type_name="list[CastRosterOutlineItem]",
        ),
        semantic_validator=lambda parsed: validate_cast_roster_outline_semantics(
            cast_roster_outline=parsed,
            num_cast=int(state["scenario_controls"]["num_cast"]),
            allow_additional_cast=bool(
                state["scenario_controls"]["allow_additional_cast"]
            ),
        ),
    )
    return {
        "cast_roster_outline": [
            item.model_dump(mode="json") for item in outline_items
        ],
        "planning_latency_seconds": float(state["planning_latency_seconds"])
        + meta.duration_seconds,
    }
