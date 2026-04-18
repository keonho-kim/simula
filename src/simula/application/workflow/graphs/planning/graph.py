"""Purpose:
- Provide the compact planning subgraph singleton.
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.nodes.planner import (
    assemble_execution_plan,
    build_cast_roster_outline,
    build_execution_plan_frame,
    build_plan_cast_chunk,
    build_planning_analysis,
    dispatch_plan_cast_chunks,
    finalize_plan,
    prepare_plan_cast_chunks,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

async def build_plan_cast_chunk_serial(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """직렬 planning 경로에서 다음 cast chunk를 하나 처리한다."""

    pending_chunks = list(state.get("pending_plan_cast_chunks", []))
    if not pending_chunks:
        return {}
    chunk = pending_chunks[0]
    result = await build_plan_cast_chunk(
        cast(
            SimulationWorkflowState,
            {
                **state,
                "plan_cast_chunk": chunk,
            },
        ),
        runtime,
    )
    return {
        "pending_plan_cast_chunks": pending_chunks[1:],
        **result,
    }


def route_plan_cast_chunk_queue(state: SimulationWorkflowState) -> str:
    """직렬 planning chunk queue 다음 단계를 고른다."""

    if list(state.get("pending_plan_cast_chunks", [])):
        return "build_plan_cast_chunk_serial"
    return "assemble_execution_plan"


def _build_parallel_planning_graph() -> StateGraph:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("build_planning_analysis", build_planning_analysis)
    graph.add_node("build_cast_roster_outline", build_cast_roster_outline)
    graph.add_node("build_execution_plan_frame", build_execution_plan_frame)
    graph.add_node("prepare_plan_cast_chunks", prepare_plan_cast_chunks)
    graph.add_node("build_plan_cast_chunk", build_plan_cast_chunk)
    graph.add_node("assemble_execution_plan", assemble_execution_plan)
    graph.add_node("finalize_plan", finalize_plan)
    graph.add_edge(START, "build_planning_analysis")
    graph.add_edge("build_planning_analysis", "build_cast_roster_outline")
    graph.add_edge("build_cast_roster_outline", "build_execution_plan_frame")
    graph.add_edge("build_execution_plan_frame", "prepare_plan_cast_chunks")
    graph.add_conditional_edges("prepare_plan_cast_chunks", dispatch_plan_cast_chunks)
    graph.add_edge("build_plan_cast_chunk", "assemble_execution_plan")
    graph.add_edge("assemble_execution_plan", "finalize_plan")
    graph.add_edge("finalize_plan", END)
    return graph


def _build_serial_planning_graph() -> StateGraph:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("build_planning_analysis", build_planning_analysis)
    graph.add_node("build_cast_roster_outline", build_cast_roster_outline)
    graph.add_node("build_execution_plan_frame", build_execution_plan_frame)
    graph.add_node("prepare_plan_cast_chunks", prepare_plan_cast_chunks)
    graph.add_node("build_plan_cast_chunk_serial", build_plan_cast_chunk_serial)
    graph.add_node("assemble_execution_plan", assemble_execution_plan)
    graph.add_node("finalize_plan", finalize_plan)
    graph.add_edge(START, "build_planning_analysis")
    graph.add_edge("build_planning_analysis", "build_cast_roster_outline")
    graph.add_edge("build_cast_roster_outline", "build_execution_plan_frame")
    graph.add_edge("build_execution_plan_frame", "prepare_plan_cast_chunks")
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
