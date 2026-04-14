"""Purpose:
- Provide the compact runtime subgraph singleton.
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.nodes.assess_round_continuation import (
    assess_round_continuation,
)
from simula.application.workflow.graphs.coordinator.nodes.resolve_round import (
    resolve_round,
)
from simula.application.workflow.graphs.coordinator.nodes.build_round_directive import (
    build_round_directive,
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
    route_after_continuation_check,
    route_after_resolution,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

_graph = StateGraph(
    state_schema=cast(Any, SimulationWorkflowState),
    context_schema=WorkflowRuntimeContext,
)
_graph.add_node("initialize_runtime_state", initialize_runtime_state)
_graph.add_node("assess_round_continuation", assess_round_continuation)
_graph.add_node("prepare_round", prepare_focus_candidates)
_graph.add_node("plan_round", build_round_directive)
_graph.add_node("generate_actor_proposal", generate_actor_proposal)
_graph.add_node("reduce_actor_proposals", reduce_actor_proposals)
_graph.add_node("resolve_round", resolve_round)
_graph.add_edge(START, "initialize_runtime_state")
_graph.add_edge("initialize_runtime_state", "assess_round_continuation")
_graph.add_conditional_edges(
    "assess_round_continuation",
    route_after_continuation_check,
    {
        "prepare_round": "prepare_round",
        "complete": END,
    },
)
_graph.add_edge("prepare_round", "plan_round")
_graph.add_conditional_edges("plan_round", dispatch_selected_actor_proposals)
_graph.add_edge("generate_actor_proposal", "reduce_actor_proposals")
_graph.add_edge("reduce_actor_proposals", "resolve_round")
_graph.add_conditional_edges(
    "resolve_round",
    route_after_resolution,
    {
        "continuation_check": "assess_round_continuation",
        "complete": END,
    },
)

RUNTIME_SUBGRAPH = _graph.compile(name="runtime")
