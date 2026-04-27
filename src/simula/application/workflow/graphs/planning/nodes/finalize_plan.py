"""Validate and persist the compact execution plan."""

from __future__ import annotations

from typing import cast

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.utils.validation import (
    validate_cast_roster_count,
    validate_major_events,
    validate_unique_cast_roster,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.reporting.events import build_plan_finalized_event
from simula.shared.io.streaming import record_simulation_log_event


def finalize_plan(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Validate and persist the compact execution plan."""

    plan = dict(state["plan"])
    cast_roster = list(plan.get("cast_roster", []))
    validate_unique_cast_roster(cast_roster)
    validate_cast_roster_count(
        cast_roster=cast_roster,
        num_cast=int(state["scenario_controls"]["num_cast"]),
        allow_additional_cast=bool(
            state["scenario_controls"]["allow_additional_cast"]
        ),
    )
    validate_major_events(
        major_events=[
            cast(dict[str, object], item)
            for item in cast(list[object], plan.get("major_events", []))
            if isinstance(item, dict)
        ],
        cast_roster=cast_roster,
        planned_max_rounds=int(state["planned_max_rounds"]),
    )
    action_catalog = cast(dict[str, object], plan.get("action_catalog", {}))
    raw_actions = action_catalog.get("actions", [])
    action_count = len(raw_actions) if isinstance(raw_actions, list) else 0
    progression_plan = cast(dict[str, object], plan.get("progression_plan", {}))
    major_event_count = len(
        [
            item
            for item in cast(list[object], plan.get("major_events", []))
            if isinstance(item, dict)
        ]
    )
    runtime.context.store.save_plan(state["run_id"], plan)
    record_simulation_log_event(
        runtime.context,
        build_plan_finalized_event(run_id=str(state["run_id"]), plan=plan),
    )
    runtime.context.logger.info(
        "계획 정리 완료 | cast=%s action_types=%s major_events=%s planned_rounds=%s default_elapsed_unit=%s",
        len(cast_roster),
        action_count,
        major_event_count,
        progression_plan.get("max_rounds", "-"),
        progression_plan.get("default_elapsed_unit", "-"),
    )
    return {"plan": plan}
