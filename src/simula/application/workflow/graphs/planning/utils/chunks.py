"""Planning cast chunk routing helpers."""

from __future__ import annotations

from langgraph.types import Send

from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

PLAN_CAST_CHUNK_SIZE = 5


def dispatch_plan_cast_chunks(state: SimulationWorkflowState) -> list[Send] | str:
    """Fan out cast chunk planning tasks."""

    pending_chunks = list(state.get("pending_plan_cast_chunks", []))
    if not pending_chunks:
        return "assemble_execution_plan"
    return [
        Send(
            "build_plan_cast_chunk",
            {
                "run_id": state["run_id"],
                "scenario": state["scenario"],
                "planning_analysis": state["planning_analysis"],
                "execution_plan_frame": state["execution_plan_frame"],
                "plan_cast_chunk": chunk,
            },
        )
        for chunk in pending_chunks
    ]


def route_plan_cast_chunk_queue(state: SimulationWorkflowState) -> str:
    """Route the serial cast chunk queue."""

    if list(state.get("pending_plan_cast_chunks", [])):
        return "build_plan_cast_chunk_serial"
    return "assemble_execution_plan"
