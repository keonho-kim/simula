"""Purpose:
- Provide the compact planning subgraph singleton.
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

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

_graph = StateGraph(
    state_schema=cast(Any, SimulationWorkflowState),
    context_schema=WorkflowRuntimeContext,
)
_graph.add_node("build_planning_analysis", build_planning_analysis)
_graph.add_node("build_cast_roster_outline", build_cast_roster_outline)
_graph.add_node("build_execution_plan_frame", build_execution_plan_frame)
_graph.add_node("prepare_plan_cast_chunks", prepare_plan_cast_chunks)
_graph.add_node("build_plan_cast_chunk", build_plan_cast_chunk)
_graph.add_node("assemble_execution_plan", assemble_execution_plan)
_graph.add_node("finalize_plan", finalize_plan)
_graph.add_edge(START, "build_planning_analysis")
_graph.add_edge("build_planning_analysis", "build_cast_roster_outline")
_graph.add_edge("build_cast_roster_outline", "build_execution_plan_frame")
_graph.add_edge("build_execution_plan_frame", "prepare_plan_cast_chunks")
_graph.add_conditional_edges("prepare_plan_cast_chunks", dispatch_plan_cast_chunks)
_graph.add_edge("build_plan_cast_chunk", "assemble_execution_plan")
_graph.add_edge("assemble_execution_plan", "finalize_plan")
_graph.add_edge("finalize_plan", END)

PLANNING_SUBGRAPH = _graph.compile(name="planning")
