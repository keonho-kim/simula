"""Purpose:
- Provide the compact runtime subgraph singleton.
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.nodes.adjudicate_step_focus import (
    resolve_step,
)
from simula.application.workflow.graphs.coordinator.nodes.build_step_focus_plan import (
    build_step_directive,
)
from simula.application.workflow.graphs.coordinator.nodes.prepare_focus_candidates import (
    prepare_focus_candidates,
)
from simula.application.workflow.graphs.runtime.nodes.actor_turn import (
    dispatch_selected_actor_proposals,
    generate_actor_proposal,
    reduce_actor_proposals,
)
from simula.application.workflow.graphs.runtime.nodes.lifecycle import (
    initialize_runtime_state,
    route_after_stop,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

_graph = StateGraph(
    state_schema=cast(Any, SimulationWorkflowState),
    context_schema=WorkflowRuntimeContext,
)
_graph.add_node("initialize_runtime_state", initialize_runtime_state)
_graph.add_node("prepare_step", prepare_focus_candidates)
_graph.add_node("plan_step", build_step_directive)
_graph.add_node("generate_actor_proposal", generate_actor_proposal)
_graph.add_node("reduce_actor_proposals", reduce_actor_proposals)
_graph.add_node("resolve_step", resolve_step)
_graph.add_edge(START, "initialize_runtime_state")
_graph.add_edge("initialize_runtime_state", "prepare_step")
_graph.add_edge("prepare_step", "plan_step")
_graph.add_conditional_edges("plan_step", dispatch_selected_actor_proposals)
_graph.add_edge("generate_actor_proposal", "reduce_actor_proposals")
_graph.add_edge("reduce_actor_proposals", "resolve_step")
_graph.add_conditional_edges(
    "resolve_step",
    route_after_stop,
    {
        "coordinator": "prepare_step",
        "complete": END,
    },
)

RUNTIME_SUBGRAPH = _graph.compile(name="runtime")
