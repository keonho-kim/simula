"""Build major events against the fixed action catalog."""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.prompts.major_event_plan_batch_prompt import (
    MAJOR_EVENT_PLAN_ITEM_EXAMPLE,
    PROMPT as MAJOR_EVENT_PLAN_BATCH_PROMPT,
)
from simula.application.workflow.graphs.planning.utils.validation import (
    build_cast_roster_outline_model,
    build_major_event_plan_batch_repair_context,
    validate_major_event_plan_batch_semantics,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import ActionCatalog, MajorEventPlanItem
from simula.shared.logging.llm import build_llm_log_context
from simula.shared.prompts.output_schema_utils import simple_array_prompt_bundle


async def build_major_events(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build major events against the fixed action catalog."""

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
    cast_roster_outline = build_cast_roster_outline_model(state["cast_roster_outline"])
    action_catalog = ActionCatalog.model_validate(state["action_catalog"])
    planned_max_rounds = int(state["planned_max_rounds"])
    major_event_prompt = MAJOR_EVENT_PLAN_BATCH_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=planning_analysis_json,
        cast_roster_outline_json=cast_roster_outline_json,
        action_catalog_json=json.dumps(
            action_catalog.model_dump(mode="json"),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        valid_action_types_json=json.dumps(
            [item.action_type for item in action_catalog.actions],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        planned_max_rounds=planned_max_rounds,
        **simple_array_prompt_bundle(
            example_item=MAJOR_EVENT_PLAN_ITEM_EXAMPLE,
        ),
    )
    major_event_batch, major_event_meta = (
        await runtime.context.llms.ainvoke_simple_with_meta(
            "planner",
            major_event_prompt,
            list[MajorEventPlanItem],
            failure_policy="fixer",
            repair_context=build_major_event_plan_batch_repair_context(
                cast_roster_outline=cast_roster_outline,
                action_catalog=action_catalog,
                planned_max_rounds=planned_max_rounds,
            ),
            semantic_validator=lambda parsed: validate_major_event_plan_batch_semantics(
                major_event_batch=parsed,
                cast_roster_outline=cast_roster_outline,
                action_catalog=action_catalog,
                planned_max_rounds=planned_max_rounds,
            ),
            log_context=build_llm_log_context(
                scope="planning-major-events",
                phase="planning",
                task_key="execution_plan_major_events",
                task_label="major events 정리",
                artifact_key="major_events",
                artifact_label="major_events",
                contract_kind="simple",
                output_type_name="list[MajorEventPlanItem]",
            ),
        )
    )
    return {
        "major_events": [item.model_dump(mode="json") for item in major_event_batch],
        "parse_failures": int(state.get("parse_failures", 0))
        + major_event_meta.parse_failure_count,
    }
