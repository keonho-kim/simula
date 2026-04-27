"""Runtime graph routing helpers."""

from __future__ import annotations

from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def route_after_scene_tick(state: SimulationWorkflowState) -> str:
    """Route after one scene tick."""

    return "complete" if state.get("stop_requested") else "select_scene_event"
