"""Purpose:
- Provide the current runtime subgraph singleton.
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime.nodes.apply_scene_delta import (
    apply_scene_delta,
)
from simula.application.workflow.graphs.runtime.nodes.build_scene_candidates import (
    build_scene_candidates,
)
from simula.application.workflow.graphs.runtime.nodes.invoke_scene_delta import (
    invoke_scene_delta,
)
from simula.application.workflow.graphs.runtime.nodes.lifecycle import (
    initialize_runtime_state,
)
from simula.application.workflow.graphs.runtime.nodes.select_scene_event import (
    select_scene_event,
)
from simula.application.workflow.graphs.runtime.utils.routing import (
    route_after_scene_tick,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def _build_runtime_graph() -> Any:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("initialize_runtime_state", initialize_runtime_state)
    graph.add_node("select_scene_event", select_scene_event)
    graph.add_node("build_scene_candidates", build_scene_candidates)
    graph.add_node("invoke_scene_delta", invoke_scene_delta)
    graph.add_node("apply_scene_delta", apply_scene_delta)
    graph.add_edge(START, "initialize_runtime_state")
    graph.add_edge("initialize_runtime_state", "select_scene_event")
    graph.add_edge("select_scene_event", "build_scene_candidates")
    graph.add_edge("build_scene_candidates", "invoke_scene_delta")
    graph.add_edge("invoke_scene_delta", "apply_scene_delta")
    graph.add_conditional_edges(
        "apply_scene_delta",
        route_after_scene_tick,
        {
            "select_scene_event": "select_scene_event",
            "complete": END,
        },
    )
    return graph


RUNTIME_SUBGRAPH_GRAPH = _build_runtime_graph()
RUNTIME_SUBGRAPH_SERIAL_GRAPH = RUNTIME_SUBGRAPH_GRAPH
RUNTIME_SUBGRAPH = RUNTIME_SUBGRAPH_GRAPH.compile(name="runtime")
RUNTIME_SUBGRAPH_SERIAL = RUNTIME_SUBGRAPH
