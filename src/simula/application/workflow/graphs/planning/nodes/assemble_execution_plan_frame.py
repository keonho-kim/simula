"""Assemble and validate the execution-plan frame."""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.utils.validation import (
    build_cast_roster_outline_model,
    validate_execution_plan_frame_semantics,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import ExecutionPlanFrameBundle


def assemble_execution_plan_frame(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Assemble and validate the execution-plan frame."""

    del runtime
    cast_roster_outline = build_cast_roster_outline_model(state["cast_roster_outline"])
    planned_max_rounds = int(state["planned_max_rounds"])
    frame_bundle = ExecutionPlanFrameBundle.model_validate(
        {
            "situation": state["situation"],
            "action_catalog": state["action_catalog"],
            "coordination_frame": state["coordination_frame"],
            "major_events": state["major_events"],
        }
    )
    semantic_issues = validate_execution_plan_frame_semantics(
        execution_plan_frame=frame_bundle,
        cast_roster_outline=cast_roster_outline,
        planned_max_rounds=planned_max_rounds,
    )
    if semantic_issues:
        raise ValueError("; ".join(semantic_issues))
    return {
        "execution_plan_frame": frame_bundle.model_dump(mode="json"),
    }
