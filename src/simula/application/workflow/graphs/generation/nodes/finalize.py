"""목적:
- generation fan-in 완료 노드를 제공한다.

설명:
- slot별 결과를 정렬하고 actor registry로 확정한다.

사용한 설계 패턴:
- fan-in finalize 패턴
"""

from __future__ import annotations

import time

from langgraph.runtime import Runtime
from langgraph.types import Overwrite

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.streaming import record_simulation_log_event
from simula.domain.actors import finalize_actor_registry
from simula.domain.log_events import build_actors_finalized_event


def finalize_generated_actors(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """fan-out 결과를 정렬하고 actor registry로 확정 및 저장한다."""

    sorted_results = sorted(
        state.get("generated_actor_results", []),
        key=lambda item: item["slot_index"],
    )
    raw_actors = [item["actor"] for item in sorted_results]
    expected_cast_ids = [str(item["cast_id"]) for item in sorted_results]
    actors = finalize_actor_registry(raw_actors)
    actual_cast_ids = [str(actor["cast_id"]) for actor in actors]
    if actual_cast_ids != expected_cast_ids:
        raise ValueError(
            "generator 결과의 cast_id 순서나 대응이 cast roster와 다릅니다."
        )
    if len(actors) < 2:
        raise ValueError("Generator가 최소 2명 이상의 actor를 생성해야 합니다.")

    latency = time.perf_counter() - float(state.get("generation_started_at", 0.0))
    parse_failures = sum(int(item["parse_failure_count"]) for item in sorted_results)
    runtime.context.logger.info("등장 인물 생성 완료")
    runtime.context.store.save_actors(state["run_id"], actors)
    record_simulation_log_event(
        runtime.context,
        build_actors_finalized_event(
            run_id=str(state["run_id"]),
            actors=actors,
        )
    )

    return {
        "actors": actors,
        "generation_latency_seconds": latency,
        "generated_actor_results": Overwrite(value=[]),
        "pending_cast_slots": [],
        "parse_failures": int(state.get("parse_failures", 0)) + parse_failures,
    }
