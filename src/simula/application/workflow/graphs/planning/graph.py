"""Purpose:
- Provide the compact planning subgraph singleton.
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.nodes.assemble_execution_plan import (
    assemble_execution_plan,
)
from simula.application.workflow.graphs.planning.nodes.assemble_execution_plan_frame import (
    assemble_execution_plan_frame,
)
from simula.application.workflow.graphs.planning.nodes.build_action_catalog import (
    build_action_catalog,
)
from simula.application.workflow.graphs.planning.nodes.build_cast_roster_outline import (
    build_cast_roster_outline,
)
from simula.application.workflow.graphs.planning.nodes.build_coordination_frame import (
    build_coordination_frame,
)
from simula.application.workflow.graphs.planning.nodes.build_major_events import (
    build_major_events,
)
from simula.application.workflow.graphs.planning.nodes.build_plan_cast_chunk import (
    build_plan_cast_chunk,
    build_plan_cast_chunk_serial,
)
from simula.application.workflow.graphs.planning.nodes.build_planning_analysis import (
    build_planning_analysis,
)
from simula.application.workflow.graphs.planning.nodes.build_situation import (
    build_situation,
)
from simula.application.workflow.graphs.planning.nodes.finalize_plan import (
    finalize_plan,
)
from simula.application.workflow.graphs.planning.nodes.prepare_plan_cast_chunks import (
    prepare_plan_cast_chunks,
)
from simula.application.workflow.graphs.planning.utils.chunks import (
    dispatch_plan_cast_chunks,
    route_plan_cast_chunk_queue,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def _add_common_nodes(
    graph: StateGraph[Any, WorkflowRuntimeContext, Any, Any],
) -> None:
    graph.add_node("build_planning_analysis", build_planning_analysis)
    graph.add_node("build_cast_roster_outline", build_cast_roster_outline)
    graph.add_node("build_situation", build_situation)
    graph.add_node("build_action_catalog", build_action_catalog)
    graph.add_node("build_coordination_frame", build_coordination_frame)
    graph.add_node("build_major_events", build_major_events)
    graph.add_node("assemble_execution_plan_frame", assemble_execution_plan_frame)
    graph.add_node("prepare_plan_cast_chunks", prepare_plan_cast_chunks)
    graph.add_node("build_plan_cast_chunk", build_plan_cast_chunk)
    graph.add_node("build_plan_cast_chunk_serial", build_plan_cast_chunk_serial)
    graph.add_node("assemble_execution_plan", assemble_execution_plan)
    graph.add_node("finalize_plan", finalize_plan)


def _build_parallel_planning_graph() -> Any:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    _add_common_nodes(graph)
    graph.add_edge(START, "build_planning_analysis")
    graph.add_edge("build_planning_analysis", "build_cast_roster_outline")
    graph.add_edge("build_cast_roster_outline", "build_situation")
    graph.add_edge("build_cast_roster_outline", "build_action_catalog")
    graph.add_edge(
        ["build_situation", "build_action_catalog"],
        "build_coordination_frame",
    )
    graph.add_edge(["build_situation", "build_action_catalog"], "build_major_events")
    graph.add_edge(
        ["build_coordination_frame", "build_major_events"],
        "assemble_execution_plan_frame",
    )
    graph.add_edge("assemble_execution_plan_frame", "prepare_plan_cast_chunks")
    graph.add_conditional_edges(
        "prepare_plan_cast_chunks",
        dispatch_plan_cast_chunks,
    )
    graph.add_edge("build_plan_cast_chunk", "assemble_execution_plan")
    graph.add_edge("assemble_execution_plan", "finalize_plan")
    graph.add_edge("finalize_plan", END)
    return graph


def _build_serial_planning_graph() -> Any:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    _add_common_nodes(graph)
    graph.add_edge(START, "build_planning_analysis")
    graph.add_edge("build_planning_analysis", "build_cast_roster_outline")
    graph.add_edge("build_cast_roster_outline", "build_situation")
    graph.add_edge("build_situation", "build_action_catalog")
    graph.add_edge("build_action_catalog", "build_coordination_frame")
    graph.add_edge("build_coordination_frame", "build_major_events")
    graph.add_edge("build_major_events", "assemble_execution_plan_frame")
    graph.add_edge("assemble_execution_plan_frame", "prepare_plan_cast_chunks")
    graph.add_conditional_edges(
        "prepare_plan_cast_chunks",
        route_plan_cast_chunk_queue,
        {
            "build_plan_cast_chunk_serial": "build_plan_cast_chunk_serial",
            "assemble_execution_plan": "assemble_execution_plan",
        },
    )
    graph.add_conditional_edges(
        "build_plan_cast_chunk_serial",
        route_plan_cast_chunk_queue,
        {
            "build_plan_cast_chunk_serial": "build_plan_cast_chunk_serial",
            "assemble_execution_plan": "assemble_execution_plan",
        },
    )
    graph.add_edge("assemble_execution_plan", "finalize_plan")
    graph.add_edge("finalize_plan", END)
    return graph


PLANNING_SUBGRAPH_GRAPH = _build_parallel_planning_graph()
PLANNING_SUBGRAPH_SERIAL_GRAPH = _build_serial_planning_graph()
PLANNING_SUBGRAPH = PLANNING_SUBGRAPH_GRAPH.compile(name="planning")
PLANNING_SUBGRAPH_SERIAL = PLANNING_SUBGRAPH_SERIAL_GRAPH.compile(name="planning")
