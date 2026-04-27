"""LangGraph node for selecting the next runtime scene event."""

from __future__ import annotations

import time

from simula.application.workflow.graphs.runtime.utils.scene_selection import (
    select_next_event as select_next_event_from_memory,
    select_scene_actors,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import SimulationPlan
from simula.domain.event_memory import refresh_event_memory


def select_scene_event(state: SimulationWorkflowState) -> dict[str, object]:
    """Select the next runtime event for the current scene tick."""

    round_index = int(state.get("round_index", 0)) + 1
    simulation_plan = SimulationPlan.model_validate(state["simulation_plan"])
    current_event_memory = refresh_event_memory(
        dict(state["event_memory"]),
        current_round_index=round_index,
    )
    selected_event = select_next_event_from_memory(
        simulation_plan=simulation_plan,
        event_memory=current_event_memory,
        current_round_index=round_index,
    )
    if selected_event is None:
        return {
            "round_index": round_index,
            "stop_requested": True,
            "stop_reason": "simulation_done",
            "event_memory": current_event_memory,
            "current_scene_event": {},
            "current_scene_actors": [],
            "scene_candidates": [],
            "current_scene_compact_input": {},
            "current_scene_delta": {},
            "current_scene_llm_meta": {},
            "last_round_latency_seconds": 0.0,
        }

    scene_actors = select_scene_actors(
        event=selected_event,
        actors=list(state["actors"]),
        simulation_plan=simulation_plan,
    )
    return {
        "round_index": round_index,
        "current_round_started_at": time.perf_counter(),
        "event_memory": current_event_memory,
        "current_scene_event": selected_event,
        "current_scene_actors": scene_actors,
        "current_scene_event_id": str(selected_event.get("event_id", "")),
    }
