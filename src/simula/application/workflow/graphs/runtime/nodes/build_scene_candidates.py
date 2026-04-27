"""LangGraph node for building scene action candidates."""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime.utils.candidates import (
    build_action_candidates,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import SimulationPlan


def build_scene_candidates(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the current scene's stateful action candidates."""

    if state.get("stop_requested"):
        return {}
    simulation_plan = SimulationPlan.model_validate(state["simulation_plan"])
    candidates = build_action_candidates(
        event=dict(state["current_scene_event"]),
        scene_actors=list(state["current_scene_actors"]),
        simulation_plan=simulation_plan,
        max_recipients_per_message=runtime.context.settings.runtime.max_recipients_per_message,
        actor_agent_states=list(state.get("actor_agent_states", [])),
        current_round_index=int(state["round_index"]),
        rng_seed=runtime.context.settings.runtime.rng_seed,
    )
    return {"scene_candidates": candidates}
