"""Assemble the execution-plan payload."""

from __future__ import annotations

from typing import cast

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.utils.payloads import (
    build_plan_payload,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def assemble_execution_plan(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Assemble the execution-plan payload from the frame and chunk results."""

    frame = cast(dict[str, object], state["execution_plan_frame"])
    generated_results = [
        cast(dict[str, object], item)
        for item in state.get("generated_plan_cast_results", [])
        if isinstance(item, dict)
    ]
    cast_items: list[dict[str, object]] = []
    for result in sorted(
        generated_results,
        key=lambda item: int(item.get("chunk_index", 0)),
    ):
        for cast_item in cast(list[object], result.get("cast_items", [])):
            if isinstance(cast_item, dict):
                cast_items.append(cast(dict[str, object], cast_item))
    cast_items.sort(key=lambda item: int(item.get("slot_index", 0)))
    normalized_cast_items = [
        {key: value for key, value in item.items() if key != "slot_index"}
        for item in cast_items
    ]
    plan = build_plan_payload(
        planning_analysis=state["planning_analysis"],
        execution_plan_frame=frame,
        cast_roster=normalized_cast_items,
    )
    runtime.context.logger.info(
        "실행 계획 조립 완료 | chunks=%s cast=%s",
        len(generated_results),
        len(normalized_cast_items),
    )
    return {"plan": plan}
