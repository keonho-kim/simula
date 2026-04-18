"""목적:
- generation 준비 및 fan-out 분기 노드를 제공한다.

설명:
- cast roster를 생성 슬롯으로 준비하고 slot별 생성 작업으로 분기한다.

사용한 설계 패턴:
- preparation + send fan-out 패턴
"""

from __future__ import annotations

import time

from langgraph.runtime import Runtime
from langgraph.types import Overwrite, Send

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.generation.states.state import CastSlotSpec
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def prepare_actor_slots(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """병렬 actor 생성에 필요한 cast slot spec을 만든다."""

    cast_roster = list(state["plan"].get("cast_roster", []))
    if not cast_roster:
        raise ValueError("cast roster 없이 actor generation을 수행할 수 없습니다.")
    slot_specs: list[CastSlotSpec] = [
        {
            "slot_index": index,
            "cast_item": cast_item,
            "cast_id": str(cast_item["cast_id"]),
            "display_name": str(cast_item["display_name"]),
            "group_name": str(cast_item.get("group_name", "")),
        }
        for index, cast_item in enumerate(cast_roster, start=1)
    ]

    runtime.context.logger.info("등장 인물 생성 시작 | 대상 %s명", len(slot_specs))
    return {
        "pending_cast_slots": slot_specs,
        "generated_actor_results": Overwrite(value=[]),
        "generation_started_at": time.perf_counter(),
    }


def dispatch_actor_slots(state: SimulationWorkflowState) -> list[Send] | str:
    """cast slot별 actor 생성 작업을 fan-out 한다."""

    pending_slots = list(state.get("pending_cast_slots", []))
    if not pending_slots:
        return "finalize_generated_actors"

    return [
        Send(
            "generate_actor_slot",
            {
                "run_id": state["run_id"],
                "scenario": state["scenario"],
                "scenario_controls": state["scenario_controls"],
                "plan": state["plan"],
                "cast_slot": slot,
            },
        )
        for slot in pending_slots
    ]
