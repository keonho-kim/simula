"""Prepare fixed-size cast chunks for planning expansion."""

from __future__ import annotations

from langgraph.runtime import Runtime
from langgraph.types import Overwrite

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.states.state import (
    PlanCastChunkSpec,
)
from simula.application.workflow.graphs.planning.utils.chunks import (
    PLAN_CAST_CHUNK_SIZE,
)
from simula.application.workflow.graphs.planning.utils.validation import (
    build_cast_roster_outline_model,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def prepare_plan_cast_chunks(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Prepare fixed-size cast chunks for parallel expansion."""

    outline_bundle = build_cast_roster_outline_model(state["cast_roster_outline"])
    pending_chunks: list[PlanCastChunkSpec] = []
    items = list(outline_bundle)
    for start_index in range(0, len(items), PLAN_CAST_CHUNK_SIZE):
        pending_chunks.append(
            {
                "chunk_index": (start_index // PLAN_CAST_CHUNK_SIZE) + 1,
                "cast_outline_items": [
                    item.model_dump(mode="json")
                    for item in items[
                        start_index : start_index + PLAN_CAST_CHUNK_SIZE
                    ]
                ],
            }
        )
    runtime.context.logger.info(
        "등장 인물 planning chunk 준비 | chunks=%s chunk_size=%s cast=%s",
        len(pending_chunks),
        PLAN_CAST_CHUNK_SIZE,
        len(items),
    )
    return {
        "pending_plan_cast_chunks": pending_chunks,
        "generated_plan_cast_results": Overwrite(value=[]),
    }
