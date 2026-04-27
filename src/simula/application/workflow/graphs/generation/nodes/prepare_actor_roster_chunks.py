"""Prepare actor roster generation chunks."""

from __future__ import annotations

import time
from typing import cast

from langgraph.runtime import Runtime
from langgraph.types import Overwrite

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.generation.states.state import (
    ActorRosterChunkSpec,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def prepare_actor_roster_chunks(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Prepare bundled actor generation chunks."""

    cast_roster = [
        {**cast(dict[str, object], item), "slot_index": index}
        for index, item in enumerate(list(state["plan"].get("cast_roster", [])), start=1)
        if isinstance(item, dict)
    ]
    if not cast_roster:
        raise ValueError("cast roster 없이 actor generation을 수행할 수 없습니다.")
    chunk_size = runtime.context.settings.runtime.actor_roster_chunk_size
    chunks: list[ActorRosterChunkSpec] = []
    for start_index in range(0, len(cast_roster), chunk_size):
        chunks.append(
            {
                "chunk_index": (start_index // chunk_size) + 1,
                "cast_items": cast_roster[
                    start_index : start_index + chunk_size
                ],
            }
        )
    runtime.context.logger.info(
        "등장 인물 bundle 생성 시작 | chunks=%s chunk_size=%s cast=%s",
        len(chunks),
        chunk_size,
        len(cast_roster),
    )
    return {
        "pending_actor_roster_chunks": chunks,
        "generated_actor_results": Overwrite(value=[]),
        "generation_started_at": time.perf_counter(),
    }
